import type { Config } from '../config'
import { readJson, writeJson } from '../lib/json'
import { Err, Ok, type Result, tryCatchAsync } from '../lib/utils/result'

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'

export type TikTokTokens = {
   accessToken: string
   refreshToken: string
   openId: string
   expiresAt: number
}

const refresh = (cfg: Config, refreshToken: string): Promise<Result<TikTokTokens, Error>> =>
   tryCatchAsync(async () => {
      const body = new URLSearchParams({
         client_key: cfg.tiktok.clientKey,
         client_secret: cfg.tiktok.clientSecret,
         grant_type: 'refresh_token',
         refresh_token: refreshToken,
      })
      const res = await fetch(TOKEN_URL, {
         method: 'POST',
         headers: { 'content-type': 'application/x-www-form-urlencoded' },
         body,
      })
      if (!res.ok) throw new Error(`tiktok token ${res.status}: ${await res.text()}`)
      const json = (await res.json()) as {
         access_token: string
         refresh_token: string
         open_id: string
         expires_in: number
      }
      return {
         accessToken: json.access_token,
         refreshToken: json.refresh_token,
         openId: json.open_id,
         expiresAt: Date.now() + json.expires_in * 1000,
      }
   })

/* Returns a usable access token, refreshing when the stored one is missing or
   within 60s of expiry. TikTok rotates the refresh token on every refresh, so
   the fresh set is persisted to tokenStorePath — config.json is never mutated. */
export const ensureAccessToken = async (cfg: Config): Promise<Result<TikTokTokens, Error>> => {
   const stored = await readJson<TikTokTokens | undefined>(cfg.tokenStorePath, undefined)
   const current: TikTokTokens = stored ?? {
      accessToken: cfg.tiktok.accessToken,
      refreshToken: cfg.tiktok.refreshToken,
      openId: cfg.tiktok.openId,
      expiresAt: 0,
   }

   if (current.accessToken && Date.now() < current.expiresAt - 60_000) return Ok(current)
   if (!current.refreshToken) {
      return current.accessToken
         ? Ok(current)
         : Err(new Error('tiktok: no refresh token and no access token to fall back on'))
   }

   const refreshed = await refresh(cfg, current.refreshToken)
   if (refreshed.isOk()) await writeJson(cfg.tokenStorePath, refreshed.value)
   return refreshed
}
