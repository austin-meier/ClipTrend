import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { type Result, tryCatchAsync } from './utils/result'

/* Reads and parses a JSON file, returning `fallback` when it's missing or
   malformed. Used for the ledger/state/token stores, which are absent on a
   first run. */
export const readJson = async <T>(path: string, fallback: T): Promise<T> => {
   const r = await tryCatchAsync<T>(async () => JSON.parse(await readFile(path, 'utf8')) as T)
   return r.isOk() ? r.value : fallback
}

export const writeJson = (path: string, data: unknown): Promise<Result<void, Error>> =>
   tryCatchAsync(async () => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, `${JSON.stringify(data, undefined, 2)}\n`, 'utf8')
   })
