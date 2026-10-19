# Anniversary preview

Use Node.js 18 or newer. Run `npm ci` and `npm run dev`, then open http://localhost:4173.

- `/`: anniversary cake, the existing memory album, and a timed film.
- `/our-story`: the original Counting Love page and its original management drawer (pencil button).
- `/admin` redirects to `/our-story`; the separate admin page was removed.

The local preview reads the public existing website data, and edits only a temporary in-memory copy. The original drawer accepts `demo` in the local preview. Production uses the existing ADMIN_PASSWORD and Blob token.

## Test and together-online cake

Open the pencil button on `/our-story`, sign into the original panel, and click **Test bánh kem**. The cake popup opens immediately on one device and its button opens the film. This preview can be repeated and does not mark the automatic cake as shown.

Both `/` and `/our-story` send an anonymous heartbeat every second while visible. Use separate browser profiles, an incognito context, or two devices to test two distinct users. Scrolling away from the hero does not disqualify a visible page.

The automatic cake requires two distinct browser identities with visible tabs and continuous heartbeats for five seconds. Extra tabs in the same browser count as one person. Hiding or closing a tab sends a disconnect and closes its cake and film; the other participant closes theirs on the next heartbeat. Lost connections expire after four seconds. Before the film finishes, returning starts a fresh five-second wait. Finishing the normal film locks the reset cycle on the server, including after reload or reconnection. Normal film entry points require the two-user gate and do not offer replay after completion. A partner whose film is already running may finish it. **Reset BK** clears the lock by creating a new cycle and requires a fresh five-second hold with two users before another viewing. **Test bánh kem** remains an independent, repeatable admin preview.

Both pages start loading film photos in chronological order in the background after rendering the story data, with two concurrent low-priority requests. Film instances share decoded media and in-flight requests. Opening the film starts the introduction immediately, without waiting for the album, and prioritizes the current scene plus the next six media scenes with at most four concurrent loads. Videos load only when they approach playback. Pending or failed images show their memory's text, and an image joins its own scene if it arrives in time; late responses cannot replace a newer scene. The timeline remains exactly 180 seconds and never pauses for network loading. Deliberate pauses are outside the playback duration.

On HTTPS deployments, film photos and album thumbnails from the configured Blob store or bundled montage use Vercel's Image Optimization API: 640px for mobile/thumbnails, 1080px for desktop, quality 70, WebP output where supported, and a one-day minimum CDN cache. Optimizer failures fall back to the original image. Local HTTP previews use original media directly. Original uploads are preserved. Image optimization behavior is configured in `vercel.json`; see https://vercel.com/docs/project-configuration/vercel-json#images.

Production `/api/presence` uses a Redis state record with atomic compare-and-set updates. It never writes or lists Blob for online status, resets, or completion locks. New databases start locked until Reset BK. Story metadata migrates to Redis on the first successful read of the existing Blob JSON; later reads and edits use Redis. Media files remain on Blob. See [redis-recovery.md](redis-recovery.md) for setup and blocked-store recovery. The local demo uses the same presence transition rules in memory, without connecting to production storage.

## Film and supplied media

Existing milestones play chronologically. Photo scene weights start at 1 second for milestones with four or more photos, or 2 seconds for smaller albums, then scale to fit the three-minute timeline. The film includes pause, seek, previous/next, music, reduced-motion support, and pause when the tab is hidden. Replay is available only in the admin preview; normal playback locks at the end. Titles, dates, and captions remain still when advancing through the same memory; only photos within the same memory dissolve. At chapter boundaries the previous scene is removed, followed by a 120ms empty beat before the next scene appears; pending reveals are cancelled on navigation or close. Photo space is reserved while loading to keep the words in place.

Immediately before “Mình còn cả mai sau”, **Những khoảnh khắc của đôi ta** plays the supplied Hh folder: 13 photos and 2 videos. Photo scene weights start at 1.5 seconds before timeline scaling; videos retain their recorded durations when they fit within the timeline. This sequence has no photo captions and creates no milestones.

Web-ready copies are stored in `assets/montage/` with their ordering and video durations in `manifest.json`. Photos were converted to JPEG with EXIF orientation applied and maximum dimensions of 2048 pixels. The two MOV clips were converted to H.264/AAC MP4 with fast-start metadata. Source files were left unchanged. Both frontends load the manifest directly, without uploading the supplied files to production or modifying the production story data. Deploying the repository will serve these assets with the site.
