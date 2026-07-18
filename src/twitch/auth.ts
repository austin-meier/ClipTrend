import { type Result, tryCatchAsync } from '../lib/utils/result'

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'

export type AppToken = { accessToken: string; expiresAt: number }

/* App access token via client-credentials — enough to read public clips.
   Cheap enough to fetch once per cycle rather than persist. */
export const getAppToken = (
   clientId: string,
   clientSecret: string
): Promise<Result<AppToken, Error>> =>
   tryCatchAsync(async () => {
      const body = new URLSearchParams({
         client_id: clientId,
         client_secret: clientSecret,
         grant_type: 'client_credentials',
      })
      const res = await fetch(TOKEN_URL, { method: 'POST', body })
      if (!res.ok) throw new Error(`twitch token ${res.status}: ${await res.text()}`)
      const json = (await res.json()) as { access_token: string; expires_in: number }
      return { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
   })
