import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Config } from './config'
import { run } from './lib/proc'
import { map, type Result } from './lib/utils/result'
import type { Clip } from './twitch/clips'

/* Twitch exposes no official clip download URL, so we shell out to yt-dlp, which
   resolves the signed media URL and muxes to a single mp4. */
export const downloadClip = async (cfg: Config, clip: Clip): Promise<Result<string, Error>> => {
   await mkdir(cfg.workDir, { recursive: true })
   const out = join(cfg.workDir, `${clip.id}.mp4`)
   const r = await run(cfg.bin.ytDlp, [
      '--no-playlist',
      '--force-overwrites',
      '--merge-output-format', 'mp4',
      '-o', out,
      clip.url,
   ])
   return map(r, () => out)
}
