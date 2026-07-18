import { run } from '../../lib/proc'
import { Err, Ok, tryCatch } from '../../lib/utils/result'
import { clamp01, type FocalPoint } from '../geometry'
import type { FocalPointDetector } from '../types'

type Settings = { pythonPath: string; scriptPath: string }

/* Delegates the "where to look" decision to an OpenCV script (face detection
   with a saliency fallback), which prints a normalized {x, y}. Kept behind the
   FocalPointDetector contract so switching to ai-vision is config-only. */
export const faceSaliencyDetector = (settings: Settings): FocalPointDetector => ({
   name: 'face-saliency',
   detect: async (ctx) => {
      if (ctx.frames.length === 0) return Err(new Error('no frames to analyse'))
      const r = await run(settings.pythonPath, [
         settings.scriptPath,
         '--width', String(ctx.width),
         '--height', String(ctx.height),
         ...ctx.frames.map((f) => f.path),
      ])
      if (r.isErr()) return Err(r.value)
      const parsed = tryCatch<{ x: number; y: number }>(() => JSON.parse(r.value.stdout))
      if (parsed.isErr())
         return Err(new Error(`detector returned non-JSON: ${r.value.stdout.slice(0, 200)}`))
      return Ok({ x: clamp01(parsed.value.x), y: clamp01(parsed.value.y) } satisfies FocalPoint)
   },
})
