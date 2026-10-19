# Recovering the blocked Blob store and moving control data to Redis

The original `/api/presence` wrote one Blob heartbeat and listed Blob prefixes
three times per second per tab. Blob counts both writes and listing as Advanced
Operations. The new presence endpoint uses Redis only and never falls back to
Blob, even if Redis is unavailable.

## Connect permanent storage

1. In the Vercel project's Storage/Marketplace area, connect an Upstash Redis
   database you own. Choose a region near the Vercel functions if available.
2. Ensure Production has `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`. The integration's `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` aliases also work. Keep credentials server-side.
3. Deploy the updated code. Until Redis is configured, shared playback is paused
   safely and each tab stops polling after the configuration error.

Presence updates use an atomic compare-and-set operation, so concurrent tabs
cannot overwrite one another. A new database starts playback locked; use the
authenticated **Reset BK** button to start the first new cycle. The two-user,
five-second hold and completion lock still apply.

## Recover the existing story

The current Blob host responds `403` with `Your store is blocked`. A code change
cannot remove the provider's block. Since no other backup is available, the
existing store must become readable before its data can be recovered. Do not
delete the store or its files.

Use Vercel's Usage/Storage panel to check when access resumes, or ask Vercel
support whether a temporary export is possible. This repository does not create
a paid subscription or change billing. Creating another Blob store does not
reset the account-wide Advanced Operations usage.

Once the old store is readable, opening `/api/data` on the new deployment will
copy the existing JSON metadata to Redis **once**, using `SET ... NX`. Later page
loads and edits use Redis instead of Blob listing or metadata uploads. Existing
image/video URLs remain intact. The original Blob files are not deleted.

For an explicit export/import, copy `.env.example` to the ignored `.env.local`,
fill in the Redis credentials, and run:

```powershell
node scripts/migrate-story.mjs --source https://savethedates.vercel.app/api/data
```

The script saves a local JSON backup under ignored `.preview/` before writing
Redis. It refuses to overwrite an existing Redis story. A recovered JSON file
path can also be supplied to `--source`. Failed downloads and invalid JSON never
replace the existing story with an empty one.

Blob is still used for the media files themselves and for actual new uploads.
If you want to remove Blob entirely, export those files after access resumes,
host them elsewhere or in the repository, and then update their URLs. Redis is
for the small story/control records, not the image/video binaries.

## Verification

```powershell
npm test
```

The tests check atomic update conflicts, visitor deduplication, late disconnects,
the five-second hold, completion/reset behavior, and absence of Blob calls in
presence and migrated story traffic. Real Upstash and production recovery must
also be checked once the owner's database is connected and Blob access resumes.

References:

- https://vercel.com/docs/vercel-blob/usage-and-pricing
- https://upstash.com/docs/redis/features/restapi
- https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval
