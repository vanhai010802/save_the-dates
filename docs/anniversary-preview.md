# Anniversary preview

Use Node.js 18 or newer. Run `npm ci` and `npm run dev`, then open http://localhost:4173.

- `/`: anniversary cake, the existing memory album, and a timed film.
- `/our-story`: the original Counting Love page and its original management drawer (pencil button).
- `/admin` redirects to `/our-story`; the separate admin page was removed.

The local preview reads the public existing website data, and edits only a temporary in-memory copy. The original drawer accepts `demo` in the local preview. Production uses the existing ADMIN_PASSWORD and Blob token. The production website has not been deployed by this change.

## Test and together-online cake

Open the pencil button on `/our-story`, sign into the original panel, and click **Test bánh kem**. The cake popup opens immediately on one device and its button opens the film. This preview can be repeated and does not mark the automatic cake as shown.

After the original heart unlock, the visible couple hero sends an anonymous heartbeat every 8 seconds. When two independent browsers/devices are present, both show the same cake popup. Tabs sharing browser storage count as one device. The popup appears once per tab session. Hidden pages stop refreshing; heartbeats expire after 30 seconds. Production `/api/presence` uses independent short-lived records in the existing Blob store, with cleanup of old records. The demo uses memory. Cross-device production behavior requires deployment.

## Film and supplied media

Existing milestones play chronologically. Milestones with four or more photos use 1 second per photo; milestones with up to three photos use 2 seconds. The film includes pause, seek, previous/next, music, replay, reduced-motion support, and pause when the tab is hidden.

Immediately before “Mình còn cả mai sau”, **Những khoảnh khắc của đôi ta** plays the supplied Hh folder: 13 photos and 2 videos. Photos last 1.5 seconds, while videos play for their recorded durations. This sequence has no photo captions and creates no milestones.

Web-ready copies are stored in `assets/montage/` with their ordering and video durations in `manifest.json`. Photos were converted to JPEG with EXIF orientation applied and maximum dimensions of 2048 pixels. The two MOV clips were converted to H.264/AAC MP4 with fast-start metadata. Source files were left unchanged. Both frontends load the manifest directly, without uploading the supplied files to production or modifying the production story data. Deploying the repository will serve these assets with the site.
