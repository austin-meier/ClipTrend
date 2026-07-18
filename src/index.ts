import { type Config, loadConfig } from './config'
import { makeDetector } from './crop/registry'
import type { FocalPointDetector } from './crop/types'
import { hasPosted, loadLedger, recordPosted, saveLedger } from './ledger'
import { log } from './lib/log'
import { loadState, pruneState, saveState } from './state'
import { processClip } from './pipeline'
import { scanChannels } from './scan'
import { ensureAccessToken } from './tiktok/auth'
import { getAppToken } from './twitch/auth'
import { getUsers } from './twitch/clips'

const HOUR_MS = 3_600_000

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/* One scan → filter → transform → post pass. Any single failure (auth, a
   channel, a clip) is logged and skipped so the long-running loop survives. */
const runCycle = async (cfg: Config, detector: FocalPointDetector): Promise<void> => {
   const now = Date.now()

   const token = await getAppToken(cfg.twitch.clientId, cfg.twitch.clientSecret)
   if (token.isErr()) return log.error('twitch auth failed', token.value.message)

   const users = await getUsers(token.value.accessToken, cfg.twitch.clientId, cfg.twitch.channels)
   if (users.isErr()) return log.error('failed to resolve channels', users.value.message)
   const missing = cfg.twitch.channels.filter(
      (login) => !users.value.some((u) => u.login.toLowerCase() === login.toLowerCase())
   )
   if (missing.length > 0) log.warn(`unknown channels ignored: ${missing.join(', ')}`)

   const state = await loadState(cfg.statePath)
   const { candidates, state: nextState } = await scanChannels(cfg, token.value, users.value, state, now)
   await saveState(cfg.statePath, pruneState(nextState, now, cfg.twitch.clipLookbackHours * 2 * HOUR_MS))
   log.info(`scan found ${candidates.length} trending candidate(s)`)

   const ledger = await loadLedger(cfg.ledgerPath)
   const fresh = candidates.filter((c) => !hasPosted(ledger, c.clip.id))
   if (fresh.length === 0) return

   const tokens = await ensureAccessToken(cfg)
   if (tokens.isErr()) return log.error('tiktok auth failed', tokens.value.message)

   const updated = await fresh.reduce<Promise<typeof ledger>>(async (accP, scored) => {
      const acc = await accP
      const result = await processClip(cfg, tokens.value.accessToken, detector, scored)
      if (result.isErr()) {
         log.warn(`skipped clip ${scored.clip.id}`, result.value.message)
         return acc
      }
      return recordPosted(acc, result.value)
   }, Promise.resolve(ledger))

   await saveLedger(cfg.ledgerPath, updated)
}

/* Thin entry point: load + validate config, build the detector, then run a
   sleep-then-scan loop forever ("run in the background for a configurable time,
   then scan"). runOnStart skips the first sleep for an immediate first pass. */
const main = async (): Promise<void> => {
   const configResult = await loadConfig('./config.json')
   if (configResult.isErr()) {
      log.error('invalid config.json:')
      configResult.value.forEach((e) => log.error(`  - ${e}`))
      process.exit(1)
   }
   const cfg = configResult.value

   const detectorResult = makeDetector(cfg.crop)
   if (detectorResult.isErr()) {
      log.error('crop detector misconfigured', detectorResult.value.message)
      process.exit(1)
   }
   const detector = detectorResult.value

   log.info(`starting: ${cfg.twitch.channels.length} channel(s), scanning every ${Math.round(cfg.pollIntervalMs / 1000)}s`)
   log.info(
      `pipelines: raw=${cfg.pipelines.raw.enabled} cropped=${cfg.pipelines.cropped.enabled && cfg.crop.enabled} (detector=${detector.name}), tiktok mode=${cfg.tiktok.postMode}/${cfg.tiktok.privacyLevel}`
   )

   let first = true
   while (true) {
      if (!(first && cfg.runOnStart)) await sleep(cfg.pollIntervalMs)
      first = false
      try {
         await runCycle(cfg, detector)
      } catch (e) {
         log.error('cycle crashed', e instanceof Error ? e.message : e)
      }
   }
}

void main()
