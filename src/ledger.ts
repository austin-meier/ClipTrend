import { readJson, writeJson } from './lib/json'
import type { Result } from './lib/utils/result'

/* One entry per clip we've already posted, so re-scans skip it. */
export type PostedRecord = {
   clipId: string
   broadcaster: string
   title: string
   postedAt: string
   pipelines: string[]
   publishIds: Record<string, string>
}

export type Ledger = Record<string, PostedRecord>

export const loadLedger = (path: string): Promise<Ledger> => readJson<Ledger>(path, {})

export const hasPosted = (ledger: Ledger, clipId: string): boolean => clipId in ledger

export const recordPosted = (ledger: Ledger, rec: PostedRecord): Ledger => ({
   ...ledger,
   [rec.clipId]: rec,
})

export const saveLedger = (path: string, ledger: Ledger): Promise<Result<void, Error>> =>
   writeJson(path, ledger)
