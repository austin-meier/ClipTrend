import type { Result } from '../lib/utils/result'
import type { FocalPoint } from './geometry'

export type FrameSample = { path: string; timestampSec: number }

export type DetectContext = {
   videoPath: string
   width: number
   height: number
   frames: readonly FrameSample[]
}

/* The swappable brain of the cropping service: given sampled frames, decide
   where the viewer's eye should land. Implementations plug in via config
   (face-saliency today, ai-vision next) — see crop/registry.ts. This is a
   genuine behaviour contract, hence an interface rather than a type. */
export interface FocalPointDetector {
   readonly name: string
   detect(ctx: DetectContext): Promise<Result<FocalPoint, Error>>
}
