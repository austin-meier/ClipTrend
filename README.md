# twitch-to-tiktok

A little background service that watches a handful of Twitch channels, notices when one of their
clips is actually gaining traction (not just old and popular), grabs it, and reposts it to TikTok.
It can post the clip as-is, or auto-crop it to a vertical 9:16 around whatever the interesting part
of the frame is.

It runs on a loop: sleep for a configurable interval, scan, post anything new and trending, repeat.

## The honest caveats up front

Three things about this problem are messier than they sound, and they shaped the whole design. Worth
reading before you wire up API keys and wonder why something's weird.

1. **Twitch has no "likes" on clips, and no trending signal.** The API gives you a cumulative
   `view_count` and nothing else. A giant number just means the clip is old and famous. So to detect
   something *rising*, the bot has to poll repeatedly and measure views-per-hour over time. That's
   why there's a `state.json` full of view snapshots and why "trending" only gets sharp after a few
   cycles. On first sight it estimates traction from `views / age`, then refines with real observed
   velocity once it has two data points.
2. **Twitch gives you no download URL.** The old thumbnail-URL hack breaks constantly, so we shell
   out to [`yt-dlp`](https://github.com/yt-dlp/yt-dlp), which is boring and reliable. It's an
   external binary you have to install.
3. **TikTok's posting API is gated.** Until your app passes TikTok's audit, `video.publish` can only
   post **privately / self-only**. You cannot auto-post publicly to an arbitrary account out of the
   gate. That's a TikTok approval thing, not a code thing, so the default config posts `SELF_ONLY`
   and you flip `privacyLevel` to `PUBLIC_TO_EVERYONE` once you're approved. Don't file a bug that
   "it only posts private," that's TikTok, not us.

None of these are blockers. They just explain the shape of things.

## What you need installed

The Node app orchestrates three external tools. Install these and make sure they're on your `PATH`
(or point at them explicitly in `config.json` under `bin`).

| Tool | Why | Install |
|------|-----|---------|
| Node.js 20+ | runs the app (uses the built-in `fetch` and test runner) | [nodejs.org](https://nodejs.org) |
| `yt-dlp` | downloads the actual clip video | [yt-dlp install](https://github.com/yt-dlp/yt-dlp#installation) |
| `ffmpeg` / `ffprobe` | probes dimensions, samples frames, does the crop/encode | [ffmpeg.org](https://ffmpeg.org/download.html) |
| Python 3 + `opencv-contrib-python` | the local face/saliency focal-point detector | `pip install opencv-contrib-python` |

The Python bit is only needed if you use the default `face-saliency` cropping detector. If you swap
to the `ai-vision` detector (see below) you don't need Python at all.

## Setup

1. Install the Node deps:
   ```bash
   npm install
   ```
2. Copy the example config and fill it in:
   ```bash
   cp config.example.json config.json
   ```
3. Get your **Twitch** app credentials from the
   [Twitch developer console](https://dev.twitch.tv/console/apps). You only need the client ID and
   secret, the bot uses an app access token to read public clips.
4. Get your **TikTok** credentials from the
   [TikTok developer portal](https://developers.tiktok.com/). For the default `DRAFT` mode you need
   the `video.upload` scope (clips land in your inbox to finish by hand, no app audit required); for
   `DIRECT_POST` you need `video.publish` (and an audit to post publicly). Either way you also need
   an OAuth'd `refresh_token` and `open_id` for the account you're posting to. The bot refreshes
   the access token itself and stores the rotating tokens in `data/tiktok-tokens.json` (it never
   rewrites your `config.json`).
5. List the channels you want to watch in `twitch.channels` (use the login names, e.g. `"shroud"`).
6. Run it:
   ```bash
   npm start
   ```

You'll see a startup banner, then it starts scanning. With `runOnStart: true` it does a scan
immediately, otherwise it waits one interval first.

## How "trending" actually gets decided

For each clip in the lookback window, it computes a views-per-hour velocity and checks three things:

- views are above an absolute floor (`minViews`), so tiny clips don't count
- velocity is above `minViewsPerHour`, so it's actually moving
- the clip is younger than `maxAgeHours`, so we're not reposting last week's news

Anything that passes gets ranked by velocity, capped at `maxPerCycle`, deduped against
`posted.json`, and sent through the pipelines. The pure scoring logic lives in `src/lib/trending.ts`
and has tests (`npm test`) if you want to see the exact behavior.

## The two pipelines and the cropping abstraction

Every clip can go out two ways, each independently toggleable in `config.json`:

- **`raw`** posts the clip at its native Twitch 16:9 (TikTok letterboxes it).
- **`cropped`** crops it to a vertical 9:16 centered on the focal point of the video.

The cropping is deliberately built so the *"where do I look"* decision is a swappable strategy. A
`FocalPointDetector` (see `src/crop/types.ts`) takes some sampled frames and returns a normalized
focal point, and a shared ffmpeg cropper applies the geometry. Two detectors ship today, picked via
`crop.detector`:

| `crop.detector` | What it does | Needs |
|-----------------|--------------|-------|
| `face-saliency` | local OpenCV: finds faces, falls back to a saliency centroid, then to center | Python + `opencv-contrib-python` |
| `ai-vision` | sends frames to Claude and asks where the subject is (structured output) | an Anthropic API key in `crop.aiVision.apiKey` |

Swapping between them is a one-line config change. Adding a third is one new file implementing
`FocalPointDetector` plus a case in `src/crop/registry.ts`, and nothing else in the pipeline changes.

## Configuration reference

Everything lives in `config.json`. Full example in `config.example.json`.

| Key | Meaning |
|-----|---------|
| `pollIntervalMs` | how long to sleep between scans |
| `runOnStart` | scan immediately on launch instead of waiting one interval |
| `workDir` | scratch dir for downloaded clips and extracted frames |
| `ledgerPath` / `statePath` / `tokenStorePath` | where the dedup ledger, view snapshots, and rotated TikTok tokens get written |
| `bin.ytDlp` / `bin.ffmpeg` / `bin.ffprobe` | paths to the external binaries if they're not on `PATH` |
| `twitch.clientId` / `twitch.clientSecret` | Twitch app credentials |
| `twitch.channels` | the channel login names to watch |
| `twitch.clipLookbackHours` | how far back to pull clips |
| `twitch.clipsPerChannel` | max clips to consider per channel per scan |
| `trending.minViews` | absolute views floor |
| `trending.minViewsPerHour` | velocity threshold for "trending" |
| `trending.maxAgeHours` | ignore clips older than this |
| `trending.maxPerCycle` | cap on how many clips to post per scan |
| `crop.enabled` | master switch for the cropped pipeline |
| `crop.detector` | `face-saliency` or `ai-vision` |
| `crop.targetAspect` | target crop aspect, e.g. `"9:16"` |
| `crop.sampleFrames` | how many frames to sample for focal detection |
| `crop.faceSaliency.pythonPath` / `.scriptPath` | python binary and the detector script |
| `crop.aiVision.apiKey` / `.model` | Anthropic key and model for the AI detector |
| `pipelines.raw.enabled` / `pipelines.cropped.enabled` | which variants to post |
| `tiktok.clientKey` / `.clientSecret` | TikTok app credentials |
| `tiktok.accessToken` / `.refreshToken` / `.openId` | the OAuth'd account tokens |
| `tiktok.postMode` | `DIRECT_POST` (publishes) or `DRAFT` (drops in your TikTok inbox to finish by hand) |
| `tiktok.privacyLevel` | `SELF_ONLY` until your app is audited, then `PUBLIC_TO_EVERYONE` etc. |
| `tiktok.titleTemplate` | caption template, `{title}` and `{broadcaster}` get substituted |
| `tiktok.disableComment` / `.disableDuet` / `.disableStitch` | the usual TikTok post toggles |

## Files it writes

Everything the bot generates lives under `data/` by default (all configurable, see the paths in the
config table above):

- `data/posted.json` is the dedup ledger, one entry per clip we've already posted.
- `data/state.json` is the view-snapshot history that powers velocity detection.
- `data/tiktok-tokens.json` holds the refreshed TikTok tokens (they rotate, so we don't touch your config).
- `data/work/` is where clips and frames land while they're being processed.

The whole `data/` folder is gitignored.

## Scripts

| Command | What |
|---------|------|
| `npm start` | run the service |
| `npm test` | run the trending/geometry unit tests |
| `npm run typecheck` | `tsc --noEmit` |
