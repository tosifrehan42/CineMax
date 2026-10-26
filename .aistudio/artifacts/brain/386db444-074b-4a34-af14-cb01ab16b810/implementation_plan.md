# CineMax Android APK Packaging & GitHub Releases Plan

## 1. Architecture & Codebase Audit Findings

1. **Vite Base Path (`vite.config.ts`)**:
   - Currently sets `const base = process.env.VITE_BASE_PATH || (command === 'build' ? '/CineMax/' : '/');`.
   - GitHub Pages requires `/CineMax/`, whereas Capacitor Android serves bundled assets from the root of its local WebView origin (`https://localhost/`) and requires `VITE_BASE_PATH=/` (or `./`).
2. **API Client & Supabase Origin Resolution (`src/services/mediaApi.ts`, `src/services/supabaseClient.ts`, `src/services/adminApi.ts`)**:
   - Inside Capacitor on Android, the WebView origin is `https://localhost` (or `http://localhost` / `capacitor://localhost`).
   - `isGithubPagesHost()` in `src/services/mediaApi.ts` only checks `*.github.io`. If `fetchApiJson()` runs inside Capacitor Android (`https://localhost`), `hasDistinctSameOrigin` would mistakenly treat `https://localhost` as a local Express server unless Capacitor native/WebView origins are recognized as static client hosts that route directly to `VITE_API_BASE_URL` (`https://cinemax-kxpv.onrender.com`).
   - `supabaseClient.ts` and `adminApi.ts` also read `VITE_API_BASE_URL` and should default to `https://cinemax-kxpv.onrender.com` on static/Capacitor hosts when `VITE_API_BASE_URL` is not explicitly overridden.
3. **Backend CORS Allowlist (`server.ts`)**:
   - `getAllowedCorsOrigins()` in `server.ts` currently allows `https://tosifrehan42.github.io` and local dev ports (`http://localhost:3000`, `http://localhost:5173`), but does **not** include Capacitor origins (`https://localhost`, `http://localhost`, `capacitor://localhost`).
   - Adding those exact Capacitor origins to `getAllowedCorsOrigins()` ensures the Render backend (`https://cinemax-kxpv.onrender.com`) permits `GET`, `POST`, `OPTIONS` requests from the installed Android APK without using wildcard `*` origins.
4. **tsconfig & Build Exclusions (`tsconfig.json`)**:
   - When `@capacitor/android` generates the `android/` native project directory, `tsconfig.json` should exclude `android` and `dist` so `bun run lint` (`tsc --noEmit`) only type-checks the TypeScript application source.

---

## 2. Planned Changes

### A. Capacitor Configuration & Scripts (`package.json`, `capacitor.config.ts`, `tsconfig.json`, `.gitignore`)
- Install `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android`.
- Create `capacitor.config.ts` configured with:
  - `appId: 'in.vertexstudios.cinemax'`
  - `appName: 'CineMax'`
  - `webDir: 'dist'`
  - `server: { androidScheme: 'https' }`
- Add helper scripts in `package.json` (preserving all existing scripts `dev`, `start`, `build`, `preview`, `clean`, `lint`):
  - `"build:android:web": "VITE_BASE_PATH=/ VITE_API_BASE_URL=https://cinemax-kxpv.onrender.com vite build"`
  - `"cap:sync": "cap sync android"`
  - `"android:prepare": "bun run build:android:web && cap sync android"`
- Exclude `android` and `dist` in `tsconfig.json` so `tsc --noEmit` stays fast and clean.

### B. Client API & Capacitor Origin Handling (`src/services/mediaApi.ts`, `src/services/supabaseClient.ts`, `src/services/adminApi.ts`)
- Add `isCapacitorOrStaticHost()` detection in `src/services/mediaApi.ts` (detecting `*.github.io`, `capacitor://`, `file://`, `(window as any).Capacitor?.isNativePlatform?.()`, or `https://localhost` without a port) so:
  - `resolveApiBaseUrl()` defaults to `https://cinemax-kxpv.onrender.com` on both GitHub Pages and the Capacitor Android app.
  - `fetchApiJson()` routes directly to `API_BASE_URL` (`https://cinemax-kxpv.onrender.com`) on Capacitor Android without attempting same-origin `/api/*` requests against the local WebView asset server.
- Update `src/services/supabaseClient.ts` and `src/services/adminApi.ts` to use the same fallback base URL (`https://cinemax-kxpv.onrender.com`) on GitHub Pages and Capacitor Android when `VITE_API_BASE_URL` is not overridden.

### C. Trusted Capacitor CORS Origins (`server.ts`)
- Add `'https://localhost'`, `'http://localhost'`, and `'capacitor://localhost'` to `getAllowedCorsOrigins()` in `server.ts` so the Render backend allows requests from the Android WebView while keeping strict origin validation on all routes (including `/api/admin/*`).

### D. Separate GitHub Actions Android APK Workflow (`.github/workflows/android-apk.yml`)
- Keep `.github/workflows/deploy.yml` untouched so GitHub Pages deployment at `/CineMax/` continues working as-is.
- Create `.github/workflows/android-apk.yml`:
  - **Triggers**: `push` to `main`/`master`, version tags `v*`, and `workflow_dispatch`.
  - **Environment**: Sets `VITE_BASE_PATH: '/'` and `VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL || 'https://cinemax-kxpv.onrender.com' }}`, plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never injects `TMDB_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or private tokens into the APK build.
  - **Steps**:
    1. Checkout repository, set up Bun, Node.js, and JDK 21 (required by Capacitor Android / Gradle).
    2. Install dependencies (`bun install --frozen-lockfile`), run `bun run lint`, and build the root-path web bundle (`bun run build`).
    3. Initialize/add the Android platform if `android/` is not yet present (`bunx cap add android`) or sync web assets (`bunx cap sync android`).
    4. Build the installable Debug APK (`./gradlew assembleDebug`) and rename/copy to `CineMax-debug.apk`.
    5. Optionally build and sign a Release APK (`./gradlew assembleRelease` + `apksigner` / Gradle signing) whenever the 4 signing secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) are configured in GitHub Secrets.
    6. Upload the generated APK(s) as downloadable GitHub Actions workflow artifacts on every run.
    7. When triggered by a version tag (`v*`), automatically create/update the GitHub Release and attach the built APK(s) (`CineMax-debug.apk` and/or `CineMax-release-signed.apk`) as downloadable release assets.

---

## 3. Verification Plan
1. Install `@capacitor/core`, `@capacitor/cli`, and `@capacitor/android`.
2. Run `bun run lint` (`tsc --noEmit`) to verify zero TypeScript errors.
3. Run both `bun run build` (GitHub Pages `/CineMax/` build) and `bun run build:android:web` (Android `/` root asset path build) and verify compiled `dist/index.html` asset paths for each target.
4. Generate/sync the Capacitor Android project (`bunx cap add android` / `bunx cap sync android`) and verify `android/app/src/main/assets/public/index.html`.
5. Document the exact signing secret setup and GitHub Release publishing steps.
