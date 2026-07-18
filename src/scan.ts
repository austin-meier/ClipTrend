import type { Config } from './config'
import { log } from './lib/log'
import { scoreClip, type TrendingScore } from './lib/trending'
import { collectOk } from './lib/utils/result'
import { historyFor, recordSnapshot, type ViewState } from './state'
import type { AppToken } from './twitch/auth'
import { getClips, type Clip } from './twitch/clips'
import type { TwitchUser } from './twitch/clips'

export type ScoredClip = { clip: Clip; score: TrendingScore }

const HOUR_MS = 3_600_000

/* Fetch recent clips per channel, fold in stored view history to score
   momentum, and return the trending candidates (velocity-ranked, capped) plus
   the updated snapshot state. IO (the fetch) is kept separate from the pure
   fold that scores and records snapshots. */
export const scanChannels = async (
   cfg: Config,
   token: AppToken,
   users: readonly TwitchUser[],
   state: ViewState,
   now: number
): Promise<{ candidates: ScoredClip[]; state: ViewState }> => {
   const startedAt = new Date(now - cfg.twitch.clipLookbackHours * HOUR_MS).toISOString()

   const perUser = await Promise.all(
      users.map((u) =>
         getClips(token.accessToken, cfg.twitch.clientId, u.id, startedAt, cfg.twitch.clipsPerChannel)
      )
   )
   perUser.forEach((r) => {
      if (r.isErr()) log.warn('getClips failed for a channel', r.value.message)
   })
   const clips = collectOk(perUser).flat()

   const folded = clips.reduce<{ candidates: ScoredClip[]; state: ViewState }>(
      (acc, clip) => {
         const score = scoreClip(
            { createdAt: clip.createdAt, now, views: clip.viewCount, history: historyFor(acc.state, clip.id) },
            cfg.trending
         )
         return {
            candidates: score.trending ? [...acc.candidates, { clip, score }] : acc.candidates,
            state: recordSnapshot(acc.state, clip.id, { at: now, views: clip.viewCount }),
         }
      },
      { candidates: [], state }
   )

   const candidates = folded.candidates
      .sort((a, b) => b.score.velocity - a.score.velocity)
      .slice(0, cfg.trending.maxPerCycle)

   return { candidates, state: folded.state }
}
