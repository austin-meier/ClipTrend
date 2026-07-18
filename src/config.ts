import { readJson } from './lib/json'
import { Err, Ok, type Result } from './lib/utils/result'

export type CropDetectorKind = 'face-saliency' | 'ai-vision'

export type TwitchConfig = {
   clientId: string
   clientSecret: string
   channels: string[]
   clipLookbackHours: number
   clipsPerChannel: number
}

export type TrendingConfig = {
   minViews: number
   minViewsPerHour: number
   maxAgeHours: number
   maxPerCycle: number
}

export type CropConfig = {
   enabled: boolean
   detector: CropDetectorKind
   targetAspect: string
   sampleFrames: number
   faceSaliency: { pythonPath: string; scriptPath: string }
   aiVision: { apiKey: string; model: string }
}

export type PipelinesConfig = {
   raw: { enabled: boolean }
   cropped: { enabled: boolean }
}

export type TikTokPrivacy =
   | 'SELF_ONLY'
   | 'PUBLIC_TO_EVERYONE'
   | 'MUTUAL_FOLLOW_FRIENDS'
   | 'FOLLOWER_OF_CREATOR'

export type TikTokConfig = {
   clientKey: string
   clientSecret: string
   accessToken: string
   refreshToken: string
   openId: string
   postMode: 'DIRECT_POST' | 'DRAFT'
   privacyLevel: TikTokPrivacy
   titleTemplate: string
   disableComment: boolean
   disableDuet: boolean
   disableStitch: boolean
}

export type Config = {
   pollIntervalMs: number
   runOnStart: boolean
   workDir: string
   ledgerPath: string
   statePath: string
   tokenStorePath: string
   bin: { ytDlp: string; ffmpeg: string; ffprobe: string }
   twitch: TwitchConfig
   trending: TrendingConfig
   crop: CropConfig
   pipelines: PipelinesConfig
   tiktok: TikTokConfig
}

const DEFAULTS: Config = {
   pollIntervalMs: 300_000,
   runOnStart: true,
   workDir: './data/work',
   ledgerPath: './data/posted.json',
   statePath: './data/state.json',
   tokenStorePath: './data/tiktok-tokens.json',
   bin: { ytDlp: 'yt-dlp', ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
   twitch: { clientId: '', clientSecret: '', channels: [], clipLookbackHours: 24, clipsPerChannel: 50 },
   trending: { minViews: 300, minViewsPerHour: 80, maxAgeHours: 48, maxPerCycle: 5 },
   crop: {
      enabled: true,
      detector: 'face-saliency',
      targetAspect: '9:16',
      sampleFrames: 12,
      faceSaliency: { pythonPath: 'python', scriptPath: './scripts/detect_focus.py' },
      aiVision: { apiKey: '', model: 'claude-opus-4-8' },
   },
   pipelines: { raw: { enabled: true }, cropped: { enabled: true } },
   tiktok: {
      clientKey: '',
      clientSecret: '',
      accessToken: '',
      refreshToken: '',
      openId: '',
      postMode: 'DRAFT',
      privacyLevel: 'SELF_ONLY',
      titleTemplate: '{title} — {broadcaster} on Twitch #twitch #clips #gaming',
      disableComment: false,
      disableDuet: false,
      disableStitch: false,
   },
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
   typeof v === 'object' && v !== undefined && v !== null && !Array.isArray(v)

/* Overlays user JSON onto the defaults, recursing into nested objects and
   ignoring keys the schema doesn't define. Arrays and scalars are replaced
   wholesale — only present overrides win, everything else keeps its default. */
const deepMerge = <T>(base: T, override: unknown): T => {
   if (!isPlainObject(base) || !isPlainObject(override)) {
      return override === undefined ? base : (override as T)
   }
   return Object.keys(base).reduce(
      (acc, key) => ({ ...acc, [key]: deepMerge(base[key as keyof T], override[key]) }),
      { ...base }
   )
}

const validate = (c: Config): string[] => {
   const errors: string[] = []
   if (!c.twitch.clientId) errors.push('twitch.clientId is required')
   if (!c.twitch.clientSecret) errors.push('twitch.clientSecret is required')
   if (c.twitch.channels.length === 0) errors.push('twitch.channels must list at least one channel')
   if (!c.tiktok.clientKey) errors.push('tiktok.clientKey is required')
   if (!c.tiktok.clientSecret) errors.push('tiktok.clientSecret is required')
   if (!c.tiktok.accessToken && !c.tiktok.refreshToken)
      errors.push('tiktok needs an accessToken or refreshToken')
   if (c.crop.enabled && c.crop.detector === 'ai-vision' && !c.crop.aiVision.apiKey)
      errors.push('crop.aiVision.apiKey is required when detector is "ai-vision"')
   if (!c.pipelines.raw.enabled && !c.pipelines.cropped.enabled)
      errors.push('at least one of pipelines.raw / pipelines.cropped must be enabled')
   return errors
}

export const loadConfig = async (path: string): Promise<Result<Config, string[]>> => {
   const raw = await readJson<unknown>(path, undefined)
   if (raw === undefined) return Err([`config not found or invalid JSON at ${path}`])
   const config = deepMerge(DEFAULTS, raw)
   const errors = validate(config)
   return errors.length === 0 ? Ok(config) : Err(errors)
}
