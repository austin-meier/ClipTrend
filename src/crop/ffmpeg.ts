import { join } from 'node:path'
import type { Config } from '../config'
import { run } from '../lib/proc'
import { defined } from '../lib/utils/functionUtils'
import { Err, Ok, type Result } from '../lib/utils/result'
import type { CropWindow } from './geometry'
import type { FrameSample } from './types'

export type Dimensions = { width: number; height: number; durationSec: number }

export const probeDimensions = async (
   cfg: Config,
   input: string
): Promise<Result<Dimensions, Error>> => {
   const r = await run(cfg.bin.ffprobe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json',
      input,
   ])
   if (r.isErr()) return Err(r.value)
   try {
      const json = JSON.parse(r.value.stdout) as {
         streams?: { width: number; height: number }[]
         format?: { duration?: string }
      }
      const stream = json.streams?.[0]
      if (!stream) return Err(new Error('ffprobe: no video stream found'))
      return Ok({ width: stream.width, height: stream.height, durationSec: Number(json.format?.duration ?? 0) })
   } catch (e) {
      return Err(e instanceof Error ? e : new Error(String(e)))
   }
}

/* Sample `count` frames evenly across the middle 80% of the clip (skipping
   intro/outro), extracted in parallel. A frame that fails to extract is simply
   dropped — the detector works from whatever frames it gets. */
export const extractFrames = async (
   cfg: Config,
   input: string,
   count: number,
   durationSec: number,
   key: string
): Promise<Result<FrameSample[], Error>> => {
   const span = durationSec > 0 ? durationSec : 1
   const timestamps = Array.from({ length: count }, (_, i) =>
      Number((span * (0.1 + (0.8 * (i + 0.5)) / count)).toFixed(3))
   )
   const samples = await Promise.all(
      timestamps.map(async (ts, i) => {
         const path = join(cfg.workDir, `${key}_frame_${i}.jpg`)
         const r = await run(cfg.bin.ffmpeg, ['-y', '-ss', String(ts), '-i', input, '-frames:v', '1', '-q:v', '3', path])
         return r.isOk() ? { path, timestampSec: ts } : undefined
      })
   )
   const frames = samples.filter(defined)
   return frames.length > 0 ? Ok(frames) : Err(new Error('ffmpeg extracted no frames'))
}

export const cropToWindow = async (
   cfg: Config,
   input: string,
   win: CropWindow,
   out: string
): Promise<Result<string, Error>> => {
   const r = await run(cfg.bin.ffmpeg, [
      '-y',
      '-i', input,
      '-vf', `crop=${win.width}:${win.height}:${win.x}:${win.y}`,
      '-c:a', 'copy',
      out,
   ])
   return r.isOk() ? Ok(out) : Err(r.value)
}
