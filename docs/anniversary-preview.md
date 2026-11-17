# Anniversary preview

Use Node.js 18 or newer. Run `npm ci` and `npm run dev`, then open http://localhost:4173.

- `/`: anniversary cake, the existing memory album, and a timed film.
- `/our-story`: the original Counting Love page and its original management drawer (pencil button).
- `/admin` redirects to `/our-story`; the separate admin page was removed.

The local preview reads the public existing website data, and edits only a temporary in-memory copy. The original drawer accepts `demo` in the local preview. Production uses the existing ADMIN_PASSWORD and Blob token.

## Automatic cake and replay

The cake automatically opens once globally across all devices. Each page makes one `/api/cake` claim; an atomic, non-overwritable Blob marker grants the first device its automatic opening. Other devices can always use **Xem lại bánh kem & kỷ niệm** or the panel replay button. **Reset bánh kem** requires a server-verified password and deletes the shared marker. Only the first visit after reset automatically opens again. There is no heartbeat or online check, and cake/film do not require Redis. If Blob is blocked, manual replay works but global claim/reset must wait until the store permits writes again.

Story data is read directly from its known original Blob JSON URL. During a 403 block, the site renders a clearly labelled partial, read-only backup. Once unblocked, reloading reads original metadata and image URLs without importing a partial backup over the original. See [cake-once.md](cake-once.md).

Both pages start loading film photos in chronological order in the background after rendering the story data, with two concurrent low-priority requests. Film instances share decoded media and in-flight requests. Opening the film starts the introduction immediately, without waiting for the album, and prioritizes the current scene plus the next six media scenes with at most four concurrent loads. Videos load only when they approach playback. Pending or failed images show their memory's text, and an image joins its own scene if it arrives in time; late responses cannot replace a newer scene. The timeline remains exactly 180 seconds and never pauses for network loading. Deliberate pauses are outside the playback duration.

On HTTPS deployments, film photos and album thumbnails from the configured Blob store or bundled montage use Vercel's Image Optimization API: 640px for mobile/thumbnails, 1080px for desktop, quality 70, WebP output where supported, and a one-day minimum CDN cache. Optimizer failures fall back to the original image. Local HTTP previews use original media directly. Original uploads are preserved. Image optimization behavior is configured in `vercel.json`; see https://vercel.com/docs/project-configuration/vercel-json#images.


## Film and supplied media

Existing milestones play chronologically. Photo scene weights start at 1 second for milestones with four or more photos, or 2 seconds for smaller albums, then scale to fit the three-minute timeline. The film includes pause, seek, previous/next, music, reduced-motion support, and pause when the tab is hidden. Replay is available to everyone, including after the film finishes. Titles, dates, and captions remain still when advancing through the same memory; only photos within the same memory dissolve. At chapter boundaries the previous scene is removed, followed by a 120ms empty beat before the next scene appears; pending reveals are cancelled on navigation or close. Photo space is reserved while loading to keep the words in place.

Immediately before “Mình còn cả mai sau”, **Những khoảnh khắc của đôi ta** plays the supplied Hh folder: 13 photos and 2 videos. Photo scene weights start at 1.5 seconds before timeline scaling; videos retain their recorded durations when they fit within the timeline. This sequence has no photo captions and creates no milestones.

Web-ready copies are stored in `assets/montage/` with their ordering and video durations in `manifest.json`. Photos were converted to JPEG with EXIF orientation applied and maximum dimensions of 2048 pixels. The two MOV clips were converted to H.264/AAC MP4 with fast-start metadata. Source files were left unchanged. Both frontends load the manifest directly, without uploading the supplied files to production or modifying the production story data. Deploying the repository will serve these assets with the site.
