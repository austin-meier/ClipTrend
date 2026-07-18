# Privacy Policy

_Last updated: July 18, 2026_

This Privacy Policy explains how **ClipTend** ("the Software") handles information. ClipTend is a
self-hosted, open-source tool that you run on your own computer. It is not a hosted service, and the
author does not operate any server that receives, stores, or processes your personal data.

## 1. Information the Software Handles

When you configure and run the Software on your own machine, it works with:

- **API credentials you provide** — your Twitch client ID/secret and your TikTok client key/secret,
  access token, refresh token, and open ID. These are read from a local configuration file.
- **Twitch clip data** — publicly available information about clips (titles, view counts, thumbnails,
  and download URLs) for the channels you choose to monitor.
- **Video files** — clips downloaded temporarily to your machine for processing before upload.
- **A local activity record** — a log of which clips have already been posted, and view-count
  snapshots used to detect trending clips.

## 2. Where This Information Lives

All of the above is stored **locally on your own computer**, in files under the Software's data
directory (by default, a `data/` folder). None of it is transmitted to the author of the Software or
to any server operated by the author. The Software has no backend and collects no analytics,
telemetry, or usage data.

## 3. How Information Is Used

The information is used solely to perform the Software's function on your behalf: reading clip data
from Twitch, downloading and processing clips, and uploading them to your own TikTok account. Your
credentials are used only to authenticate your own API requests to Twitch and TikTok.

## 4. Third-Party Services

The Software communicates directly from your computer with third-party APIs:

- **Twitch** — to read public clip data. See the [Twitch Privacy Notice](https://www.twitch.tv/p/legal/privacy-notice/).
- **TikTok** — to upload clips to your account. See the [TikTok Privacy Policy](https://www.tiktok.com/legal/privacy-policy).
- **Optional AI cropping** — if you enable the AI vision cropping feature, sampled video frames are
  sent to your configured AI provider to determine the focal point for cropping.

These services process your requests under their own privacy policies. The author of the Software is
not responsible for their practices.

## 5. Data Retention

Because all data stays on your machine, you control its retention. You can delete the Software's
`data/` directory and configuration file at any time to remove locally stored information. Tokens and
records persist only until you delete them.

## 6. Children's Privacy

The Software is not directed to children and is intended for use only by individuals old enough to
hold Twitch and TikTok accounts under those platforms' terms.

## 7. Changes to This Policy

This Privacy Policy may be updated from time to time. Changes will be posted here with an updated
date.

## 8. Contact

For questions about this Privacy Policy, contact: **austin.meier@hotmail.com**
