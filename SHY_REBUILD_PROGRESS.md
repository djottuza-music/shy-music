# SHY rebuild progress

Updated: 2026-09-13

## Authoritative production

- Repository: `https://github.com/djottuza-music/shy-music`
- Production branch: `main`
- Web: `https://djottuza-music.github.io/shy-music/`
- Supabase project: `rfnmzxxbznkzzsufyoxf`
- Android application id: `music.shy.app`
- Historical references only: Lovable SHY and `kundaeliko99-byte/shy-music-source`

## Feature matrix

| Area | Verified historical behavior | New rebuild status | Remaining work |
| --- | --- | --- | --- |
| Discovery | Home shelves, discover filters, charts, Fresh Ink, radio | Home, artists, discover filters and catalogue search | Charts/editorial ranking and radio are outstanding |
| Songs and albums | Detail pages, artwork, hover play, sharing | Detail pages, real cover URLs, playback, sharing and free eligible downloads | Artist album uploader and richer metadata editing |
| Player | Persistent mini player, expanded player, queue, shuffle/repeat, media session | Persistent DOM audio, expanded player, queue and reordering, shuffle/repeat, Media Session metadata | Native Android background service and interruption tests |
| Library | Likes and listener library | Authenticated likes library | Playlists and followed-artists view |
| Artist dashboard | Overview, songs, albums, Watch Out, sales, gifts, analytics, messages, profile, settings | Role-protected dashboard, real stream totals, song/album lists, scheduled-release editing, analytics and profile settings | Complete song/album editing; sales, gifts and messages depend on defined business workflows |
| Watch Out | Historical source contains both an alerts panel and a scheduled-release editor; user requirements established scheduled-release editing | Scheduled songs/albums with editable title and date/time | Add release warnings and validation alerts |
| Artist support | Follow, motivate/mobile money, marketplace enquiries | Follow and stable motivation details | Verified payment provider and marketplace contract workflow |
| Safety and support | Legal/privacy pages and admin controls | Content reports, support queue, account deletion requests and protected admin review are live through migration `20260913010000` | Exercise full authenticated support/admin journeys after role provisioning |
| Admin | Account roles, suspensions and subscription controls | Least-privilege role/suspension, moderation, cases and audit UI | Provision/verify first admin and test every role |
| Downloads | Free-public-download migration in historical repo | Signed, time-limited URLs for published, artist-enabled tracks; no payment/account requirement | Browser and Android download tests with imported media |
| Android | Capacitor wrapper | Capacitor 8 project with official launcher artwork, embedded web build and CI-built installable APK | Test CI APK on device; prepare a signed AAB for store release |

## Completed in current milestone

- Added the official SHY logo to the web shell, authentication, PWA metadata, favicon and Android launcher assets.
- Made global search navigate to real filtered catalogue results.
- Connected the notifications bell and mark-all-read action.
- Added a working player queue with ordering controls and current-track like action.
- Added safe download filenames while retaining signed private audio URLs.
- Added content reporting, in-app support, account profile settings and deletion requests.
- Expanded protected administration for users, catalogue moderation, reports, support, deletion requests and audit history.
- Removed Capacitor `server.url`; Android now embeds a tested build instead of operating as a remote website wrapper.
- Added a visible build identifier to distinguish deployed releases.
- Split routes into lazy-loaded chunks, reducing the startup JavaScript bundle from about 620 KB to about 257 KB.
- Added GitHub Actions Android builds so the host Java loopback fault cannot block APK creation.

## Verification evidence

- TypeScript, lint and the production build pass after this milestone.
- Five unit tests pass, including download extension and safe-filename coverage.
- `npm audit --omit=dev`: zero vulnerabilities.
- Secret scan found no committed key or token; only documented environment variable names.
- The production build was opened in a browser: the logo, home, search route, sign-in inputs and sign-up mode rendered and remained responsive.
- Android web synchronization passes. The local APK compile is blocked before project evaluation by this Windows Java runtime's `Unable to establish loopback connection`; CI now builds the same APK on Ubuntu.
- Migration `20260913010000_support_and_account_protection.sql` was applied successfully to production. Anonymous table reads remain denied, and invalid anonymous support submissions are rejected by server validation.
- The authorised `djottuza@gmail.com` account exists, but the live check found only the listener role, no artist profile and no imported catalogue. Role provisioning and media import require the confirmed live access step.

## Next actions

1. Provision `djottuza@gmail.com` as the authorised artist and first admin, then import the two albums from `D:\KOPA MUSIC` without committing media or service keys.
2. Commit, push, verify GitHub Pages and download the CI-produced Android test APK.
3. Add deeper integration coverage for queue behavior, support validation and role guards.
