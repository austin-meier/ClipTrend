import { type Config } from '../config'
import { log } from '../lib/log'
import { Err, type Result } from '../lib/utils/result'
import { cropToWindow, extractFrames, probeDimensions } from './ffmpeg'
import { cropWindowFor, parseAspect, type FocalPoint } from './geometry'
import type { FocalPointDetector } from './types'

const CENTER: FocalPoint = { x: 0.5, y: 0.5 }

/* Produce a 9:16 crop of `input` centred on the detector's focal point. The
   detector chooses *where* to look; this shared cropper applies the geometry
   and encodes. Detector or frame-extraction failures degrade to a centre crop
   rather than dropping the clip — a slightly-off crop still posts. */
export const cropVideo = async (
   cfg: Config,
   detector: FocalPointDetector,
   key: string,
   input: string,
   out: string
): Promise<Result<string, Error>> => {
   const dim = await probeDimensions(cfg, input)
   if (dim.isErr()) return Err(dim.value)

   const framesResult = await extractFrames(cfg, input, cfg.crop.sampleFrames, dim.value.durationSec, key)
   const frames = framesResult.isOk() ? framesResult.value : []

   const focalResult = await detector.detect({
      videoPath: input,
      width: dim.value.width,
      height: dim.value.height,
      frames,
   })
   if (focalResult.isErr())
      log.warn(`focal detection failed (${detector.name}); centring crop`, focalResult.value.message)
   const focal = focalResult.isOk() ? focalResult.value : CENTER

   const window = cropWindowFor(dim.value.width, dim.value.height, parseAspect(cfg.crop.targetAspect), focal)
   return cropToWindow(cfg, input, window, out)
}
