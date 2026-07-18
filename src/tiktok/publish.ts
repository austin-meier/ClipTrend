import { readFile, stat } from 'node:fs/promises'
import type { Config } from '../config'
import { type Result, tryCatchAsync } from '../lib/utils/result'

const INIT_DIRECT = 'https://open.tiktokapis.com/v2/post/publish/video/init/'
const INIT_INBOX = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/'

const MAX_SINGLE_CHUNK = 64 * 1024 * 1024

export type PublishResult = { publishId: string }

type InitResponse = {
   data?: { publish_id?: string; upload_url?: string }
   error?: { code?: string; message?: string }
}

/* Two-step TikTok upload: initialise a publish (which returns a signed upload
   URL), then PUT the file bytes to it. DIRECT_POST publishes (privacy-gated
   until the app is audited — SELF_ONLY otherwise); DRAFT drops it in the app's
   inbox for manual finishing. Single-chunk only — Twitch clips are short. */
export const publishVideo = (
   cfg: Config,
   accessToken: string,
   filePath: string,
   title: string
): Promise<Result<PublishResult, Error>> =>
   tryCatchAsync(async () => {
      const { size } = await stat(filePath)
      if (size > MAX_SINGLE_CHUNK)
         throw new Error(`clip is ${size} bytes; single-chunk upload caps at 64MB`)

      const direct = cfg.tiktok.postMode === 'DIRECT_POST'
      const sourceInfo = { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 }
      const initBody = direct
         ? {
              post_info: {
                 title,
                 privacy_level: cfg.tiktok.privacyLevel,
                 disable_comment: cfg.tiktok.disableComment,
                 disable_duet: cfg.tiktok.disableDuet,
                 disable_stitch: cfg.tiktok.disableStitch,
              },
              source_info: sourceInfo,
           }
         : { source_info: sourceInfo }

      const initRes = await fetch(direct ? INIT_DIRECT : INIT_INBOX, {
         method: 'POST',
         headers: {
            Authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json; charset=UTF-8',
         },
         body: JSON.stringify(initBody),
      })
      const init = (await initRes.json()) as InitResponse
      if (!initRes.ok || !init.data?.publish_id || !init.data.upload_url)
         throw new Error(`tiktok init failed: ${init.error?.message ?? initRes.status}`)

      const bytes = await readFile(filePath)
      const uploadRes = await fetch(init.data.upload_url, {
         method: 'PUT',
         headers: {
            'content-type': 'video/mp4',
            'content-length': String(size),
            'content-range': `bytes 0-${size - 1}/${size}`,
         },
         body: bytes,
      })
      if (!uploadRes.ok)
         throw new Error(`tiktok upload failed: ${uploadRes.status} ${await uploadRes.text()}`)

      return { publishId: init.data.publish_id }
   })
