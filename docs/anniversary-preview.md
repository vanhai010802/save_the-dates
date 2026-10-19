# Anniversary preview

Use Node.js 18 or newer. Run `npm ci` and `npm run dev`, then open http://localhost:4173.

- `/`: anniversary cake, the existing memory album, and a timed film.
- `/our-story`: the original Counting Love page and its original management drawer (pencil button).
- `/admin` redirects to `/our-story`; the separate admin page was removed.

The local preview reads the public existing website data, and edits only a temporary in-memory copy. The original drawer accepts `demo` in the local preview. Production uses the existing ADMIN_PASSWORD and Blob token.

## Test and together-online cake

Open the pencil button on `/our-story`, sign into the original panel, and click **Test bánh kem**. The cake popup opens immediately on one device and its button opens the film. This preview can be repeated and does not mark the automatic cake as shown.

Both `/` and `/our-story` send an anonymous heartbeat every 8 seconds after loading. Each open page instance counts separately, so two tabs can test the rule. Background tabs, the heart unlock screen, and scrolling away from the hero do not disqualify an open page. Closed pages send a best-effort leave signal; heartbeats expire after 90 seconds to accommodate background timer throttling. Frozen tabs cannot refresh until the browser resumes them.

The automatic cake is shown once globally per reset cycle, to the pages present when at least two participants are detected. Reloading or opening new tabs does not replay it. The original panel's authenticated **Reset BK** button creates a new cycle, allowing the next two open participants to trigger it again. **Test bánh kem** remains independent and repeatable. Existing tabs continue heartbeats after showing the cake so a reset works without reopening them.

Production `/api/presence` uses independent short-lived `presence/` records and persistent `celebration/` reset/event markers in the existing Blob store. Expired heartbeats are cleaned up; celebration markers survive server restarts. The local demo stores both presence and reset state in memory only.

## Film and supplied media

Existing milestones play chronologically. Milestones with four or more photos use 1 second per photo; milestones with up to three photos use 2 seconds. The film includes pause, seek, previous/next, music, replay, reduced-motion support, and pause when the tab is hidden.

Immediately before “Mình còn cả mai sau”, **Những khoảnh khắc của đôi ta** plays the supplied Hh folder: 13 photos and 2 videos. Photos last 1.5 seconds, while videos play for their recorded durations. This sequence has no photo captions and creates no milestones.

Web-ready copies are stored in `assets/montage/` with their ordering and video durations in `manifest.json`. Photos were converted to JPEG with EXIF orientation applied and maximum dimensions of 2048 pixels. The two MOV clips were converted to H.264/AAC MP4 with fast-start metadata. Source files were left unchanged. Both frontends load the manifest directly, without uploading the supplied files to production or modifying the production story data. Deploying the repository will serve these assets with the site.
