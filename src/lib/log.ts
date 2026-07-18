type Level = 'info' | 'warn' | 'error' | 'debug'

const emit = (level: Level, msg: string, extra?: unknown): void => {
   const line = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} ${msg}`
   const out = level === 'error' || level === 'warn' ? console.error : console.log
   extra === undefined ? out(line) : out(line, extra)
}

export const log = {
   info: (msg: string, extra?: unknown) => emit('info', msg, extra),
   warn: (msg: string, extra?: unknown) => emit('warn', msg, extra),
   error: (msg: string, extra?: unknown) => emit('error', msg, extra),
   debug: (msg: string, extra?: unknown) => emit('debug', msg, extra),
}
