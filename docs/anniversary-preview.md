# Anniversary preview

## Deployment updates and Safari cache

Vercel runs `npm run build` and serves static files from `public/`; the root `api/` functions remain server-side. The build computes a content version from the source files, stamps both HTML pages, and adds that version to local JavaScript, CSS, and JSON URLs, including nested module imports and dynamically loaded styles. Source files are unchanged. HTML and assets revalidate, and `/version.json` uses `no-store`.

Both pages check the version at startup, every minute while visible, and on `pageshow`, tab return, focus, or reconnection. A new version triggers a navigation preserving the route, query parameters, and fragment, with a version parameter to bypass stale HTML. Updates wait while a dialog, film, or management drawer is open or a form field has focus. Offline checks fail silently, and a repeated version cannot create a reload loop. This updates this site's resources without deleting Safari history, authentication, or saved settings.

A tab that predates this updater needs one initial reload after deployment to receive it. Local `npm run dev` serves source files without update polling; `npm run build` generates the versioned production output for testing.

Use Node.js 18 or newer. Run `npm ci` and `npm run dev`, then open http://localhost:4173.

- `/`: anniversary cake, the existing memory album, and a timed film.
- `/our-story`: Counting Love, a dedicated **Kỷ niệm** section above **Hành trình yêu**, and the management drawer (pencil button). The only anniversary entry is **Kỷ niệm 6 tháng**, opening the existing film directly; its month count stays six independently of the general anniversary configuration.
- `/admin` redirects to `/our-story`; the separate admin page was removed.

The local preview reads the public existing website data, and edits only a temporary in-memory copy. The original drawer accepts `demo` in the local preview. Production uses the existing ADMIN_PASSWORD and Blob token.

## Anniversary film

Neither page starts the automatic cake flow or shows the old cake replay/reset controls. On `/our-story`, select **Kỷ niệm 6 tháng** to play or replay the film directly. The management drawer no longer contains cake or reset buttons. The admin field remains a native password input: a visual overlay reveals only the newest typed character for one second, then masks it. Paste/autofill remain masked; blur and submit immediately mask the field. Incorrect entries remain available for correction. The standalone anniversary page retains its existing hero and film button.

Story data is read directly from its known original Blob JSON URL. During a 403 block, the site renders a clearly labelled partial, read-only backup. Once unblocked, reloading reads original metadata and image URLs without importing a partial backup over the original. See [cake-once.md](cake-once.md).

Both pages start loading eligible film photos in chronological order in the background after rendering the story data, with two concurrent low-priority requests. Film instances share decoded images and in-flight image requests. Opening the film starts the introduction immediately, without waiting for the album, and prioritizes the current photo plus the next six photo scenes with at most four concurrent loads. Each video mounts in its visible scene before its source is loaded; videos are not decoded in the detached image-preload queue. Pending or failed images show their memory's text, and an image joins its own scene if it arrives in time; late responses cannot replace a newer scene. Runtime is the sum of scene durations, without a three-minute target. Photos and text keep advancing while images load; video scenes wait for actual playback. Deliberate pauses are outside the playback duration.

### Safari clip loading

The previous video loader waited for `loadeddata` on a detached video before mounting it, with two ten-second timeouts. Safari may honor only metadata preload, so this can leave just the clip title onscreen until it times out. Playback promise rejections were also ignored, leaving no recovery when automatic playback was refused. This is consistent with the reported iPhone symptom; the affected physical phone has not been inspected. See [Apple's Safari video guidance](https://developer.apple.com/documentation/webkit/delivering-video-content-for-safari) and [WebKit's playback policy](https://webkit.org/blog/6784/new-video-policies-for-ios/).

Video now mounts first with muted/default-muted and inline attributes, then loads and plays without waiting for `loadeddata`. Metadata sets its duration and seek position. Blocked playback offers **Chạm để phát video** synchronously from a user tap; network errors and loading stalls offer retry and a direct video link. Native video controls remain available after fallback. Clips never silently advance while loading or blocked. Closing or changing scenes cancels old handlers and releases the source.

Both bundled clips, `08-IMG_8438.mp4` and `12-IMG_8501.mp4`, were inspected: H.264, YUV420P, AAC audio, fast-start metadata, durations about 8.15 and 10.61 seconds. Production returns `206 Partial Content`, the requested byte count, `Content-Range`, and `video/mp4` for both. Chromium and WebKit checks cover both clips plus simulated autoplay rejection and manual recovery; engine checks do not replace testing on the affected iPhone.

On HTTPS deployments, film photos and album thumbnails from the configured Blob store or bundled montage use Vercel's Image Optimization API: 640px for mobile/thumbnails, 1080px for desktop, quality 70, WebP output where supported, and a one-day minimum CDN cache. Optimizer failures fall back to the original image. Local HTTP previews use original media directly. Original uploads are preserved. Image optimization behavior is configured in `vercel.json`; see https://vercel.com/docs/project-configuration/vercel-json#images.


## Film and supplied media

Only milestones dated strictly before **2026-10-19** play, in chronological order; the live album is unchanged. Photos last at least 3.6 seconds for milestones with four or more photos, or 4.5 seconds for smaller albums. Longer captions and chapter text receive more reading time. Videos use their recorded duration, updated when loaded if story metadata was missing. The film includes pause, seek, previous/next, music, reduced-motion support, and pause when the tab is hidden. Replay is available to everyone, including after the film finishes. The outgoing scene fades completely over 300ms before the next scene is mounted; at most one scene is in the stage. Pending reveals are cancelled on navigation or close. Paused navigation and reduced-motion playback switch immediately. Photo space is reserved while loading to keep the words in place.

Immediately before “Mình còn cả mai sau”, **Những khoảnh khắc của đôi ta** plays the supplied Hh folder: 13 photos and 2 videos. Photos last 3 seconds; videos retain their recorded durations. This sequence has no photo captions and creates no milestones. Its heading is omitted when no montage media is available.

The speed button beside the music control cycles through 1×, 1.5×, and 2× for photos and text. Attached videos always play at 1×. Their timeline follows actual clip playback and waits through loading or buffering until the clip ends; photos and text then resume the selected speed. Pause, seek, and replay preserve that selection. Background music keeps its original tempo.

Web-ready copies are stored in `assets/montage/` with their ordering and video durations in `manifest.json`. Photos were converted to JPEG with EXIF orientation applied and maximum dimensions of 2048 pixels. The two MOV clips were converted to H.264/AAC MP4 with fast-start metadata. Source files were left unchanged. Both frontends load the manifest directly, without uploading the supplied files to production or modifying the production story data. Deploying the repository will serve these assets with the site.
