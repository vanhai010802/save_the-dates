# Anniversary preview

Use Node.js 18 or newer. Run `npm ci` and `npm run dev`, then open http://localhost:4173.

- `/`: anniversary cake, the existing memory album, and a timed film.
- `/our-story`: the original Counting Love page and its original management drawer (pencil button).
- `/admin` redirects to `/our-story`; the separate admin page was removed.

The local preview reads the public existing website data, and edits only a temporary in-memory copy. The original drawer accepts `demo` in the local preview. Production uses the existing ADMIN_PASSWORD and Blob token.

## Automatic cake and replay

The cake automatically opens once globally across all devices. Each page makes one `/api/cake` claim; an atomic, non-overwritable Blob marker grants the first device its automatic opening. Other devices can always use **Xem lại bánh kem & kỷ niệm** or the panel replay button. **Reset bánh kem** requires a server-verified password and deletes the shared marker. Only the first visit after reset automatically opens again. There is no heartbeat or online check, and cake/film do not require Redis. If Blob is blocked, manual replay works but global claim/reset must wait until the store permits writes again.

Story data is read directly from its known original Blob JSON URL. During a 403 block, the site renders a clearly labelled partial, read-only backup. Once unblocked, reloading reads original metadata and image URLs without importing a partial backup over the original. See [cake-once.md](cake-once.md).

Both pages start loading eligible film photos in chronological order in the background after rendering the story data, with two concurrent low-priority requests. Film instances share decoded media and in-flight requests. Opening the film starts the introduction immediately, without waiting for the album, and prioritizes the current scene plus the next six media scenes with at most four concurrent loads. Videos load only when they approach playback. Pending or failed images show their memory's text, and an image joins its own scene if it arrives in time; late responses cannot replace a newer scene. Runtime is the sum of scene durations, without a three-minute target. Photos and text keep advancing while images load; video scenes wait for actual playback. Deliberate pauses are outside the playback duration.

On HTTPS deployments, film photos and album thumbnails from the configured Blob store or bundled montage use Vercel's Image Optimization API: 640px for mobile/thumbnails, 1080px for desktop, quality 70, WebP output where supported, and a one-day minimum CDN cache. Optimizer failures fall back to the original image. Local HTTP previews use original media directly. Original uploads are preserved. Image optimization behavior is configured in `vercel.json`; see https://vercel.com/docs/project-configuration/vercel-json#images.


## Film and supplied media

Only milestones dated strictly before **2026-10-19** play, in chronological order; the live album is unchanged. Photos last at least 3.6 seconds for milestones with four or more photos, or 4.5 seconds for smaller albums. Longer captions and chapter text receive more reading time. Videos use their recorded duration, updated when loaded if story metadata was missing. The film includes pause, seek, previous/next, music, reduced-motion support, and pause when the tab is hidden. Replay is available to everyone, including after the film finishes. The outgoing scene fades completely over 300ms before the next scene is mounted; at most one scene is in the stage. Pending reveals are cancelled on navigation or close. Paused navigation and reduced-motion playback switch immediately. Photo space is reserved while loading to keep the words in place.

Immediately before “Mình còn cả mai sau”, **Những khoảnh khắc của đôi ta** plays the supplied Hh folder: 13 photos and 2 videos. Photos last 3 seconds; videos retain their recorded durations. This sequence has no photo captions and creates no milestones. Its heading is omitted when no montage media is available.

The speed button beside the music control cycles through 1×, 1.5×, and 2× for photos and text. Attached videos always play at 1×. Their timeline follows actual clip playback and waits through loading or buffering until the clip ends; photos and text then resume the selected speed. Pause, seek, and replay preserve that selection. Background music keeps its original tempo.

Web-ready copies are stored in `assets/montage/` with their ordering and video durations in `manifest.json`. Photos were converted to JPEG with EXIF orientation applied and maximum dimensions of 2048 pixels. The two MOV clips were converted to H.264/AAC MP4 with fast-start metadata. Source files were left unchanged. Both frontends load the manifest directly, without uploading the supplied files to production or modifying the production story data. Deploying the repository will serve these assets with the site.
