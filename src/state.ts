import { readJson, writeJson } from './lib/json'
import type { Snapshot } from './lib/trending'
import type { Result } from './lib/utils/result'

/* Per-clip view-count history, keyed by clip id. This is what turns a single
   view number into a velocity signal across cycles. */
export type ViewState = Record<string, Snapshot[]>

const MAX_SNAPSHOTS = 50

export const loadState = (path: string): Promise<ViewState> => readJson<ViewState>(path, {})

export const historyFor = (state: ViewState, clipId: string): Snapshot[] => state[clipId] ?? []

export const recordSnapshot = (state: ViewState, clipId: string, snap: Snapshot): ViewState => ({
   ...state,
   [clipId]: [...(state[clipId] ?? []), snap].slice(-MAX_SNAPSHOTS),
})

/* Drop clips not seen within the retention window so state.json stays bounded. */
export const pruneState = (state: ViewState, now: number, maxAgeMs: number): ViewState =>
   Object.fromEntries(
      Object.entries(state).filter(([, snaps]) => {
         const last = snaps[snaps.length - 1]
         return last !== undefined && now - last.at <= maxAgeMs
      })
   )

export const saveState = (path: string, state: ViewState): Promise<Result<void, Error>> =>
   writeJson(path, state)
