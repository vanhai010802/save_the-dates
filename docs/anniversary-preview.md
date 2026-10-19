# Anniversary preview

Use Node.js 18 or newer. Run `npm ci` and `npm run dev`, then open http://localhost:4173.

- `/`: anniversary cake, the existing memory album, and a timed film.
- `/our-story`: the original Counting Love page and its original management drawer (pencil button).
- `/admin` redirects to `/our-story`; the separate admin page was removed.

The local preview reads the public existing website data, and edits only a temporary in-memory copy. The original drawer accepts `demo` in the local preview. Production uses the existing ADMIN_PASSWORD and Blob token.

## Test and together-online cake

Open the pencil button on `/our-story`, sign into the original panel, and click **Test bánh kem**. The cake popup opens immediately on one device and its button opens the film. This preview can be repeated and does not mark the automatic cake as shown.

Both `/` and `/our-story` send an anonymous heartbeat every second while visible. Use separate browser profiles, an incognito context, or two devices to test two distinct users. Scrolling away from the hero does not disqualify a visible page.

The automatic cake requires two distinct browser identities with visible tabs and continuous heartbeats for five seconds. Extra tabs in the same browser count as one person. Hiding or closing a tab sends a disconnect and closes its cake and film; the other participant closes theirs on the next heartbeat. Lost connections expire after four seconds. Returning starts a fresh five-second wait. **Reset BK** allows the currently connected pair to open the cake again; **Test bánh kem** remains independent and repeatable.

The memory film preloads media with four concurrent requests and retries a failed load once. Media that still cannot load is excluded instead of showing empty photo frames. After preparation, the playback timeline lasts exactly 120 seconds, preserving video clip durations where possible and fitting the other scenes into the remaining time. Loading and deliberate pauses are outside the playback duration.

Production `/api/presence` uses independent short-lived `presence/` records and persistent `celebration/` reset markers in the existing Blob store. Expired heartbeats are cleaned up; celebration markers survive server restarts. The local demo stores both presence and reset state in memory only.

## Film and supplied media

Existing milestones play chronologically. Photo scene weights start at 1 second for milestones with four or more photos, or 2 seconds for smaller albums, then scale to fit the two-minute timeline. The film includes pause, seek, previous/next, music, replay, reduced-motion support, and pause when the tab is hidden.

Immediately before “Mình còn cả mai sau”, **Những khoảnh khắc của đôi ta** plays the supplied Hh folder: 13 photos and 2 videos. Photo scene weights start at 1.5 seconds before timeline scaling; videos retain their recorded durations when they fit within the timeline. This sequence has no photo captions and creates no milestones.

Web-ready copies are stored in `assets/montage/` with their ordering and video durations in `manifest.json`. Photos were converted to JPEG with EXIF orientation applied and maximum dimensions of 2048 pixels. The two MOV clips were converted to H.264/AAC MP4 with fast-start metadata. Source files were left unchanged. Both frontends load the manifest directly, without uploading the supplied files to production or modifying the production story data. Deploying the repository will serve these assets with the site.
