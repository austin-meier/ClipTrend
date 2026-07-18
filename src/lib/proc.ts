import { spawn } from 'node:child_process'
import { Err, Ok, type Result } from './utils/result'

export type ProcOutput = { code: number; stdout: string; stderr: string }

/* Thin wrapper over spawn that resolves to a Result instead of throwing, so
   callers treat a failed external tool (yt-dlp / ffmpeg / python) the same way
   they treat any other recoverable error. A non-zero exit is an Err. */
export const run = (cmd: string, args: readonly string[]): Promise<Result<ProcOutput, Error>> =>
   new Promise((resolve) => {
      const child = spawn(cmd, [...args], { windowsHide: true })
      const stdout: Buffer[] = []
      const stderr: Buffer[] = []
      child.stdout.on('data', (d: Buffer) => stdout.push(d))
      child.stderr.on('data', (d: Buffer) => stderr.push(d))
      child.on('error', (e) => resolve(Err(e)))
      child.on('close', (code) => {
         const out = {
            code: code ?? -1,
            stdout: Buffer.concat(stdout).toString(),
            stderr: Buffer.concat(stderr).toString(),
         }
         resolve(
            code === 0
               ? Ok(out)
               : Err(new Error(`${cmd} exited ${code}: ${out.stderr.slice(0, 400) || out.stdout.slice(0, 400)}`))
         )
      })
   })
