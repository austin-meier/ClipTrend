import { readFile } from 'node:fs/promises'
import { tryCatchAsync } from '../../lib/utils/result'
import { clamp01, type FocalPoint } from '../geometry'
import type { FocalPointDetector } from '../types'

type Settings = { apiKey: string; model: string }

const API_URL = 'https://api.anthropic.com/v1/messages'

/* Structured-output schema constrains the reply to exactly the focal point. */
const FOCAL_SCHEMA = {
   type: 'object',
   properties: {
      x: { type: 'number', description: 'Horizontal focal point, 0 (left) to 1 (right)' },
      y: { type: 'number', description: 'Vertical focal point, 0 (top) to 1 (bottom)' },
   },
   required: ['x', 'y'],
   additionalProperties: false,
} as const

const PROMPT =
   'These are evenly-spaced frames from a short video that will be cropped to a ' +
   'vertical 9:16 format. Identify the single point the crop should centre on — ' +
   'the main subject or focus of attention (a face, a character, the action). ' +
   'Return normalized coordinates where x=0 is the left edge and x=1 the right.'

/* AI-vision focal detector — the config-swap alternative to face-saliency,
   selected via `crop.detector: "ai-vision"`. Sends sampled frames to Claude and
   pins the reply to {x, y} with structured outputs. Same FocalPointDetector
   contract, so nothing downstream changes. */
export const aiVisionDetector = (settings: Settings): FocalPointDetector => ({
   name: 'ai-vision',
   detect: (ctx) =>
      tryCatchAsync<FocalPoint>(async () => {
         const images = await Promise.all(
            ctx.frames.map(async (f) => ({
               type: 'image' as const,
               source: {
                  type: 'base64' as const,
                  media_type: 'image/jpeg' as const,
                  data: (await readFile(f.path)).toString('base64'),
               },
            }))
         )
         const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
               'x-api-key': settings.apiKey,
               'anthropic-version': '2023-06-01',
               'content-type': 'application/json',
            },
            body: JSON.stringify({
               model: settings.model,
               max_tokens: 256,
               output_config: { format: { type: 'json_schema', schema: FOCAL_SCHEMA } },
               messages: [{ role: 'user', content: [...images, { type: 'text', text: PROMPT }] }],
            }),
         })
         if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
         const json = (await res.json()) as { content: { type: string; text?: string }[] }
         const text = json.content.find((b) => b.type === 'text')?.text ?? '{}'
         const point = JSON.parse(text) as { x: number; y: number }
         return { x: clamp01(point.x), y: clamp01(point.y) }
      }),
})
