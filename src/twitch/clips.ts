import { type Result, tryCatchAsync } from '../lib/utils/result'

const HELIX = 'https://api.twitch.tv/helix'

export type TwitchUser = { id: string; login: string; displayName: string }

export type Clip = {
   id: string
   url: string
   broadcasterId: string
   broadcasterName: string
   creatorName: string
   title: string
   viewCount: number
   createdAt: number
   durationSec: number
}

type RawUser = { id: string; login: string; display_name: string }
type RawClip = {
   id: string
   url: string
   broadcaster_id: string
   broadcaster_name: string
   creator_name: string
   title: string
   view_count: number
   created_at: string
   duration: number
}

const chunk = <T>(xs: readonly T[], size: number): T[][] =>
   xs.length === 0 ? [] : [xs.slice(0, size), ...chunk(xs.slice(size), size)]

const helixGet = async <T>(path: string, token: string, clientId: string): Promise<T> => {
   const res = await fetch(`${HELIX}${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
   })
   if (!res.ok) throw new Error(`helix ${path} ${res.status}: ${await res.text()}`)
   return (await res.json()) as T
}

const toClip = (r: RawClip): Clip => ({
   id: r.id,
   url: r.url,
   broadcasterId: r.broadcaster_id,
   broadcasterName: r.broadcaster_name,
   creatorName: r.creator_name,
   title: r.title,
   viewCount: r.view_count,
   createdAt: Date.parse(r.created_at),
   durationSec: r.duration,
})

/* Resolve channel logins to user IDs — the clips endpoint keys off broadcaster
   id, not name. Logins are batched at Helix's 100-per-request limit. */
export const getUsers = (
   token: string,
   clientId: string,
   logins: readonly string[]
): Promise<Result<TwitchUser[], Error>> =>
   tryCatchAsync(async () => {
      const pages = await Promise.all(
         chunk(logins, 100).map((batch) => {
            const qs = batch.map((l) => `login=${encodeURIComponent(l)}`).join('&')
            return helixGet<{ data: RawUser[] }>(`/users?${qs}`, token, clientId)
         })
      )
      return pages
         .flatMap((p) => p.data)
         .map((u) => ({ id: u.id, login: u.login, displayName: u.display_name }))
   })

/* Clips for one broadcaster created since `startedAt` (RFC3339). Helix returns
   them view-count descending, so `first` bounds how many top clips we consider. */
export const getClips = (
   token: string,
   clientId: string,
   broadcasterId: string,
   startedAt: string,
   first: number
): Promise<Result<Clip[], Error>> =>
   tryCatchAsync(async () => {
      const qs = `broadcaster_id=${broadcasterId}&started_at=${encodeURIComponent(startedAt)}&first=${Math.min(first, 100)}`
      const json = await helixGet<{ data: RawClip[] }>(`/clips?${qs}`, token, clientId)
      return json.data.map(toClip)
   })
