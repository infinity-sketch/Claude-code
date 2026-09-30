# Lumière Content HQ

Content planning for Lumière's Instagram + TikTok. It's a static, installable web app with no build step and no server.

- **Run locally:** `npm run serve:lumiere` → http://localhost:8080 (the passcode lock needs https or localhost)
- **Deploy:** any static host. On GitHub Pages serving `/docs`, it lives at `<pages-url>/lumiere/`. On a phone, use "Add to Home Screen" to open it full screen.
- **Tests:** `npm test` (link parsing, batch counter, analytics, Instagram mapping)

## Where data lives

Everything is stored in the browser's IndexedDB **on the device you use**, including uploaded audio. It does not sync between devices. Use Settings → Export backup to save it or move it to another device.
The passcode (PBKDF2-hashed) keeps other people out of the app on your device. It does not encrypt the data.

## Data model

| Store | Record |
|---|---|
| `ideas` | `id, title, notes, links[], category, status, tags[], soundId, preScheduleStatus` |
| `shoots` | `id, date, location, notes, checklist[{id,text,done}], shotList[{ideaId,done}]` |
| `posts` | `id, date, platform (instagram/tiktok), ideaId, caption, hashtags, time, soundId, notes, status (planned/posted), postedAt, rating, ratingWhy, externalId?, permalink?` — one per date + platform |
| `metrics` | `id, postId, source (manual/instagram_api), capturedAt, views, likes, comments, shares, saves, follows, linkClicks, externalId?` — append-only snapshots, newest wins |
| `followers` | `id, date, platform, count, source` |
| `sounds` | `id, title, artist, mood, platform (instagram/tiktok/both), link, fileId, fileName, hot, hotSince, notes` |
| `notes` | `id, section (hooks/captions/hashtags/voice/general), title, body` |
| `files` | audio blobs |

Status flow: Idea → Ready to Shoot → Shot → Edited → Scheduled → Posted. Assigning an idea to the calendar moves it to Scheduled, clearing its last slot moves it back, and Mark as Posted sets it to Posted.

## Instagram API (phase 2)

`js/integrations/instagram.js` maps Graph API media insights onto the `metrics` snapshot shape (`source: 'instagram_api'`). To connect, you need a small server or edge function that holds the access token (never put it in this static site). That function would pull `/{media-id}/insights` for each post with an `externalId` and write the snapshots. Your manual entries stay in place alongside them.
