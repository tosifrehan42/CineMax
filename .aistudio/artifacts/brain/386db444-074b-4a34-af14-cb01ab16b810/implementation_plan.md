# Real TMDB Trailer Fetching & Embedded YouTube Player

Replaces the simulated animation in CineMax's Trailer Modal with a real YouTube embedded player powered by official TMDB `/movie/{id}/videos` and `/tv/{id}/videos` metadata, complete with numeric TMDB ID resolution, real YouTube thumbnail previews, a multi-trailer switcher, embed-restriction error handling, and an honest "Trailer unavailable" state with a "Search on YouTube" fallback.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design and architectural decisions incorporate your confirmed preferences from our clarification step:

- **Confirmed Decision 1 — Real Thumbnail Preview Before Playback**: When the Trailer Modal opens and a valid TMDB YouTube trailer is resolved, the modal first displays the real YouTube trailer thumbnail (`maxresdefault` with `hqdefault` fallback), official video title, and release metadata. Clicking **Play Official Trailer** launches and autoplays the real embedded YouTube player.
- **Confirmed Decision 2 — Top-Ranked Trailer with Alternate Switcher**: Videos returned by TMDB are ranked by official status, type (`Trailer` over `Teaser`), language (`en`), and publication date. When multiple suitable trailers or teasers exist, a switcher bar below the player lets users switch between them.
- **Confirmed Decision 3 — Dual Server Proxy & Client `VITE_TMDB_API_KEY` Support**: Trailer metadata requests check the server proxy (`/api/trailer/:type/:id`) first and seamlessly support direct client-side TMDB `/videos` resolution on GitHub Pages when `VITE_TMDB_API_KEY` is configured, while caching results in memory to prevent duplicate requests.

---

## 1. Overview & Problem Diagnosis

- **Why the Current Player Was Broken**:
  - The existing `TrailerModal` component did not fetch video keys or mount an `<iframe>` or `<video>` element. Instead, it rendered a static backdrop image with an animated CSS waveform and a `setInterval` loop that incremented a fake `progress` state from `0%` to `100%` over a hardcoded `2:14` duration.
- **What This Fix Delivers**:
  - **Accurate TMDB Numeric ID Resolution**: Resolves the numeric TMDB ID and media type (`movie` or `tv`) before calling TMDB's `/videos` endpoint—extracting numeric IDs directly from `tmdb-*` items, mapping seed slugs via the canonical TMDB ID table, and resolving TVMaze (`tvmaze-tv-*`) or Apple iTunes (`live-movie-*`) catalog items via external IDs (`imdb_id` / `thetvdb_id`) or title + release-year search so slugs are never passed where a numeric TMDB ID is required.
  - **Real YouTube IFrame Player**: Uses the official YouTube embed player (`youtube-nocookie.com/embed/<key>?enablejsapi=1&playsinline=1&rel=0`) with the YouTube IFrame Player API to support native play, pause, timeline scrubbing, volume, captions, fullscreen, and real-time embed error detection (`onError` codes `2`, `5`, `100`, `101`, `150`).
  - **Honest Fallback Behavior**: When no playable trailer is returned by TMDB (or when embedding is restricted by the publisher), no fake player or fake progress bar is shown. Instead, the modal displays a clear **Trailer unavailable** state with a **Search on YouTube** action (or **Watch on YouTube** if a valid video key exists but disallows embedding).

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Loading State**: Opening the modal displays a clean skeleton loader (`Fetching official trailer metadata...`) inside the 16:9 viewport frame.
  2. **Thumbnail Preview State**: Once resolved, the 16:9 frame displays the real YouTube trailer thumbnail (`https://i.ytimg.com/vi/<key>/maxresdefault.jpg` with automatic fallback to `hqdefault.jpg`), the official TMDB video name (e.g., *"Official Trailer"*), video type, and a central **Play Trailer** button.
  3. **Active Embedded Playback**: Clicking Play mounts the real YouTube player with full native playback controls (play/pause, seek bar, volume, quality, fullscreen) and a direct **Watch on YouTube** link in the footer bar.
  4. **Multi-Trailer Switcher**: If TMDB returns multiple official trailers or teasers, a horizontal selector strip below the video canvas allows switching active videos with a single click.
  5. **Unavailable / Restricted Fallback**: If no trailer is found, the 16:9 frame shows **Trailer unavailable** with an explanation and a clearly labelled **Search on YouTube** button (`https://www.youtube.com/results?search_query=<Title>+<Year>+Official+Trailer`). If a video owner blocks third-party embedding, the player catches the YouTube API error and offers a direct **Watch on YouTube** button.
  6. **Clean Modal Close**: Clicking the close button, clicking the backdrop, or pressing `Escape` immediately unmounts the modal and destroys the YouTube iframe instance so audio stops immediately.
- **Visual Identity & Theme**:
  - Preserves CineMax's obsidian dark modal frame (`#090a0f` / `#0d0e14`), subtle hairline borders (`border-white/10`), `Outfit` display headers, `Plus Jakarta Sans` UI controls, and `JetBrains Mono` (`tabular-nums`) metadata.

---

## 3. Key Product Decisions & Trade-Offs

- **Deterministic TMDB Video Ranking Algorithm**:
  - *Chosen Approach*: Filter TMDB `/videos` results strictly to `site === 'YouTube'` with valid 11-character video keys (`/^[A-Za-z0-9_-]{11}$/`). Score candidates by:
    1. Official flag (`official === true`: `+100`)
    2. Video type (`Trailer`: `+80`, `Teaser`: `+40`, `Clip`/`Featurette`: `+10`)
    3. Title match (`"Official Trailer"` / `"Main Trailer"`: `+35`, penalizing `"Recap"` / `"Commentary"`)
    4. Language (`iso_639_1 === 'en'`: `+20`)
    5. Recency (`published_at` timestamp tie-breaker)
  - *Why*: Guarantees that official theatrical/series trailers are prioritized over teasers, featurettes, or foreign-language clips.
- **YouTube IFrame API + Standard Embed Hybrid**:
  - *Chosen Approach*: Render a real `<iframe>` pointed at `https://www.youtube-nocookie.com/embed/<key>?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1` and bind the YouTube IFrame API `YT.Player` listener to detect `onError` events (`101`/`150` embedding disabled by owner, `100` video removed).
  - *Why*: Gives users genuine native YouTube playback controls across desktop and mobile while programmatically catching unembeddable videos so users are never stuck on a broken iframe screen.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Resolution Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        User Clicks "Watch Trailer"                          │
│                  Opens TrailerModal(media: MediaItem)                       │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             Trailer Resolution Service (In-Memory Cached)                   │
│                                                                             │
│  1. Identify Numeric TMDB ID & Media Type ('movie' | 'tv'):                 │
│     • tmdb-movie-123 / tmdb-tv-456 ──► Direct numeric ID (123 / 456)        │
│     • Seed slug (e.g. dune-part-two) ► Canonical TMDB ID map                │
│     • tvmaze-tv-* / live-movie-*   ──► Resolve via TVMaze IMDB ID (/find)   │
│                                        or TMDB /search/{movie|tv}           │
│                                                                             │
│  2. Fetch TMDB /movie/{id}/videos or /tv/{id}/videos:                       │
│     • Path A: Server Proxy (/api/trailer/:type/:id)                         │
│     • Path B: Direct TMDB v3/v4 API (when VITE_TMDB_API_KEY is configured)  │
│     • Path C: Verified TMDB video metadata for built-in seed catalog        │
│                                                                             │
│  3. Filter & Rank Official YouTube Videos:                                  │
│     • site === 'YouTube' & valid 11-char key                                │
│     • Rank: Official + Type (Trailer > Teaser) + Language + Published Date  │
└───────────────┬─────────────────────────────────────────────┬───────────────┘
                │                                             │
     [ Videos Found (>= 1) ]                       [ No Suitable Trailer ]
                │                                             │
                ▼                                             ▼
┌───────────────────────────────────────┐   ┌─────────────────────────────────┐
│  Stage 1: Real Thumbnail Preview      │   │  "Trailer Unavailable" View     │
│  • YouTube maxresdefault/hqdefault    │   │  • Honest status message        │
│  • Official title & badge             │   │  • "Search on YouTube" button   │
│  • Click Play ──► Mounts real         │   │    (clearly labelled as search) │
│    YouTube Embed IFrame Player        │   └─────────────────────────────────┘
│  • Multi-Trailer Switcher strip       │
│  • On Embed Error (101/150) ──►       │
│    Shows "Watch on YouTube" fallback  │
└───────────────────────────────────────┘
```

### Interactive Component & State Mapping

1. **Numeric TMDB ID & Video Resolution (`fetchMediaTrailers`)**:
   - Returns `{ status: 'ok' | 'unavailable' | 'error', tmdbId: number | null, videos: TrailerVideoItem[], primaryVideo: TrailerVideoItem | null, youtubeSearchUrl: string, errorMessage?: string }`.
   - Caches responses in an in-memory `Map<string, TrailerLookupResult>` keyed by `${media.type}:${media.id}` to eliminate duplicate requests when reopening a title's trailer.
2. **Trailer Modal Lifecycle (`TrailerModal`)**:
   - **`loading`**: Displayed while `fetchMediaTrailers(media)` is in flight.
   - **`preview`**: Shows the real YouTube thumbnail for `activeVideo.key`, video title, type (`Official Trailer` / `Teaser`), and a prominent Play button.
   - **`playing`**: Mounts the YouTube `<iframe>` player with `autoplay=1` and attaches the YouTube IFrame API `onError` callback.
   - **`embed_restricted`**: Triggered if YouTube emits error `100`, `101`, or `150`, explaining that the publisher disabled external embedding and providing a direct **Watch on YouTube** link (`https://www.youtube.com/watch?v=<key>`).
   - **`unavailable`**: Rendered when `videos.length === 0`, showing **Trailer unavailable** and a **Search on YouTube** button.
   - **Cleanup on Close / Video Switch**: Unmounts the `<iframe>` and calls `player.destroy()` when the modal closes or when the user switches to a different trailer in the switcher bar.
