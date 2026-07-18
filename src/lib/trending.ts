export type Snapshot = { at: number; views: number }

export type ClipObservation = {
   createdAt: number
   now: number
   views: number
   history: readonly Snapshot[]
}

export type TrendingThresholds = {
   minViews: number
   minViewsPerHour: number
   maxAgeHours: number
}

export type TrendingScore = {
   ageHours: number
   lifetimeVelocity: number
   observedVelocity: number | undefined
   velocity: number
   trending: boolean
}

const HOUR_MS = 3_600_000
const MIN_AGE_HOURS = 1 / 60 /* floor age at one minute so a brand-new clip doesn't divide by ~zero */

export const ageHours = (createdAt: number, now: number): number =>
   Math.max((now - createdAt) / HOUR_MS, MIN_AGE_HOURS)

/* Cumulative views spread over the clip's lifetime — the traction estimate we
   can make on first sight, before we have two snapshots to measure against. */
export const lifetimeVelocity = (views: number, createdAt: number, now: number): number =>
   views / ageHours(createdAt, now)

/* Views/hour measured across stored snapshots. Undefined until we've observed
   the clip in a prior cycle, since real velocity needs two points in time. */
export const observedVelocity = (
   views: number,
   now: number,
   history: readonly Snapshot[]
): number | undefined => {
   const earliest = history[0]
   if (!earliest) return undefined
   const dtHours = (now - earliest.at) / HOUR_MS
   if (dtHours <= 0) return undefined
   return Math.max(views - earliest.views, 0) / dtHours
}

/* "Trending" = gaining traction now (velocity over threshold) AND past an
   absolute-views floor AND still fresh. Observed velocity wins once available,
   falling back to the lifetime estimate for clips seen for the first time. */
export const scoreClip = (obs: ClipObservation, t: TrendingThresholds): TrendingScore => {
   const age = ageHours(obs.createdAt, obs.now)
   const lifetime = lifetimeVelocity(obs.views, obs.createdAt, obs.now)
   const observed = observedVelocity(obs.views, obs.now, obs.history)
   const velocity = observed ?? lifetime
   const trending = obs.views >= t.minViews && velocity >= t.minViewsPerHour && age <= t.maxAgeHours
   return { ageHours: age, lifetimeVelocity: lifetime, observedVelocity: observed, velocity, trending }
}
