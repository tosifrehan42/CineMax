# CineMax — Quality & File Size Estimator Implementation Plan

## 1. Overview & Goals
Add a dedicated, studio-grade **Quality & File Size Estimator** inside CineMax that lets film and TV enthusiasts accurately estimate storage requirements and bandwidth footprints for **Movies**, **Single TV Episodes**, and **Full TV Seasons** without requiring login or altering any existing catalogue, watchlist, or recommendation features.

## 2. Navigation & Feature Access
- **Top & Mobile Navigation (`Navbar.tsx` & `types/index.ts`)**:
  - Extend `TabView` to `'home' | 'discover' | 'watchlist' | 'estimator' | 'profile'`.
  - Add a **"Quality & Size"** (`HardDrive` / `Sliders` icon) navigation tab in the desktop header bar and mobile bottom navigation bar.
- **Title Detail Quick-Launch (`DetailModal.tsx` & `App.tsx`)**:
  - Add an **"Estimate Quality & File Size"** action button inside `DetailModal` (under the poster quick-actions column) that closes the modal, switches to the **Quality & Size** tab, and automatically prefills the selected Movie or TV Series (including active season & loaded episode runtime metadata).
- **Clear Estimation Disclaimer**:
  - Display a prominent studio notice at the top of the tool explaining that results are bitrate-based estimates and that actual release sizes vary depending on scene complexity, grain, HDR metadata, variable bitrate (VBR) encoding, and audio track count.

## 3. Inputs & Metadata Prefill
- **Built-in Title Search & Catalogue Picker**:
  - Search bar inside the estimator that queries both the loaded CineMax catalogue and live TMDB search (`searchMediaCatalogue`), plus quick-select chips for popular movies and series.
  - Selecting a title fetches full details (`fetchTitleDetails`) and, for TV shows, season episode lists (`fetchTvSeasonEpisodes`) to extract real runtime and episode counts.
  - **Strict Runtime Rule**: If a selected title or episode does not have confirmed runtime metadata from TMDB/catalogue, the tool **never silently assumes a fallback runtime**—it alerts the user that runtime metadata is unavailable for that title and prompts for manual hours/minutes entry.
- **Content Scope Selector**:
  - **Movie**: Hours + Minutes manual or prefilled inputs.
  - **TV Episode**: Single episode runtime (Minutes, or Hours + Minutes) with season/episode selector when linked to a TV series.
  - **Full TV Season**: Episode count + Average episode runtime (auto-calculated from actual episode runtimes when a TV season is selected, or manually editable).
- **Encoding & Release Parameters**:
  - **Resolution**: `480p`, `720p HD`, `1080p Full HD`, `1440p`, `2160p / 4K`.
  - **Source / Release Type**: `Streaming / Web-DL`, `Blu-ray encode`, `Blu-ray Remux`, `Compressed WEBRip`, `Custom bitrate`.
  - **Video Codec**: `H.264 / AVC`, `H.265 / HEVC`, `AV1`, `Other / custom bitrate`.
  - **Audio Format**:
    - `AAC stereo` (~192 kbps / 0.192 Mbps)
    - `AC-3 / E-AC-3` (~384 kbps / 0.384 Mbps)
    - `E-AC-3 5.1` (~640 kbps / 0.640 Mbps)
    - `DTS / DTS-HD` (~1,536 kbps / 1.536 Mbps)
    - `TrueHD / Atmos` (~4,500 kbps / 4.500 Mbps)
    - `Custom audio bitrate` (editable kbps / Mbps)
    - `No audio` (`0 Mbps`, for video-only calculations)
  - **Container / Muxing Overhead**:
    - Editable percentage input defaulting to **1.5%** (covers MKV/MP4 packet headers, seek tables, and subtitle tracks).

## 4. Calculation Engine & Bitrate Matrix (`src/utils/fileSizeCalculator.ts`)
- **Core Formula**:
  $$\text{Total Average Bitrate (Mbps)} = (\text{Video Bitrate}_{\text{Mbps}} + \text{Audio Bitrate}_{\text{Mbps}}) \times \left(1 + \frac{\text{Overhead \%}}{100}\right)$$
  $$\text{File Size (Decimal GB)} = \frac{\text{Total Average Bitrate (Mbps)} \times \text{Runtime (seconds)}}{8,000}$$
  $$\text{File Size (Decimal MB)} = \text{File Size (Decimal GB)} \times 1,000$$
- **Realistic Multi-Dimensional Preset Matrix**:
  - Combines **Resolution × Source Type × Video Codec** to produce realistic `(low, typical, high)` video bitrate ranges in Mbps:
    - *Compressed WEBRip* & *Streaming / Web-DL* scale appropriately by resolution and codec efficiency (`AV1` ~30% lower than `HEVC`; `HEVC` ~35% lower than `H.264`).
    - *Blu-ray Encode* uses higher archival bitrates.
    - *Blu-ray Remux* uses authentic disc bitrates (e.g., `1080p Remux` ~24–36 Mbps; `2160p / 4K Remux` ~50–85 Mbps typical ~64 Mbps).
  - Users can also override the preset at any time by tweaking the **Editable Video Bitrate (Mbps)** or **Editable Audio Bitrate (kbps)** directly.

## 5. Results Breakdown, Season Summary & Preset Comparison
- **Primary Readout Panel**:
  - Displays **Typical Estimated File Size** (in decimal `GB` and `MB`, explicitly labeled `1 GB = 1,000 MB`), alongside the **Low – High Range** (`e.g., 4.2 GB – 6.8 GB`) when using preset ranges.
  - For **Full TV Seasons**, displays both **Per-Episode Size** and **Full Season Total Size** (`episode count × average episode size` or exact sum of episode runtimes).
- **Component Breakdown Bar**:
  - Visual progress bar and tabular readout showing exact **Video Track Size & Bitrate**, **Audio Track Size & Bitrate**, **Container Overhead Size**, and **Total Runtime Used** (in hours, minutes, and exact seconds).
- **Side-by-Side Comparison Table**:
  - Automatically computes and compares 5 benchmark profiles for the exact same runtime and audio selection:
    1. `720p H.264` (Web-DL)
    2. `1080p H.264` (Web-DL)
    3. `1080p HEVC` (Web-DL / Encode)
    4. `4K HEVC` (Streaming / Encode)
    5. `4K Remux` (Untouched Blu-ray Remux)
- **Utility Controls**:
  - **Copy Results**: Formats a clean summary report to the clipboard via `navigator.clipboard.writeText` with visible toast/button confirmation and fallback handling.
  - **Reset**: Restores default selections cleanly.
  - **Why Sizes Vary Guide**: Concise technical breakdown explaining VBR scene complexity, film grain, HDR10/Dolby Vision layers, and lossless audio tracks.
