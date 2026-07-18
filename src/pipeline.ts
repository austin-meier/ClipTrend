import { join } from 'node:path'
import type { Config } from './config'
import { cropVideo } from './crop/service'
import type { FocalPointDetector } from './crop/types'
import { downloadClip } from './download'
import type { PostedRecord } from './ledger'
import { log } from './lib/log'
import { Err, Ok, type Result } from './lib/utils/result'
import type { ScoredClip } from './scan'
import { publishVideo } from './tiktok/publish'
import type { Clip } from './twitch/clips'

type Variant = { pipeline: string; path: string }

const renderTitle = (template: string, clip: Clip): string =>
   template.replaceAll('{title}', clip.title).replaceAll('{broadcaster}', clip.broadcasterName)

/* Download the clip once, then run each enabled pipeline — raw (16:9,
   letterboxed on TikTok) and cropped (9:16, focal-cropped) — and post each
   resulting file. Returns a ledger record iff at least one variant posted. */
export const processClip = async (
   cfg: Config,
   accessToken: string,
   detector: FocalPointDetector,
   scored: ScoredClip
): Promise<Result<PostedRecord, Error>> => {
   const { clip } = scored
   const download = await downloadClip(cfg, clip)
   if (download.isErr()) return Err(download.value)
   const source = download.value

   const variants: Variant[] = []
   if (cfg.pipelines.raw.enabled) variants.push({ pipeline: 'raw', path: source })
   if (cfg.pipelines.cropped.enabled && cfg.crop.enabled) {
      const out = join(cfg.workDir, `${clip.id}_9x16.mp4`)
      const cropped = await cropVideo(cfg, detector, clip.id, source, out)
      if (cropped.isOk()) variants.push({ pipeline: 'cropped', path: cropped.value })
      else log.warn(`crop failed for ${clip.id}; skipping cropped variant`, cropped.value.message)
   }
   if (variants.length === 0) return Err(new Error('no pipeline produced a video'))

   const title = renderTitle(cfg.tiktok.titleTemplate, clip)
   const publishIds = await variants.reduce<Promise<Record<string, string>>>(async (accP, variant) => {
      const acc = await accP
      const published = await publishVideo(cfg, accessToken, variant.path, title)
      if (published.isErr()) {
         log.warn(`tiktok post failed for ${clip.id} (${variant.pipeline})`, published.value.message)
         return acc
      }
      log.info(`posted ${clip.id} (${variant.pipeline}) -> ${published.value.publishId}`)
      return { ...acc, [variant.pipeline]: published.value.publishId }
   }, Promise.resolve({}))

   if (Object.keys(publishIds).length === 0) return Err(new Error('all tiktok uploads failed'))

   return Ok({
      clipId: clip.id,
      broadcaster: clip.broadcasterName,
      title: clip.title,
      postedAt: new Date().toISOString(),
      pipelines: Object.keys(publishIds),
      publishIds,
   })
}
