# GitHub Actions & GitHub Pages White-Screen Fix Plan

## Root Cause Diagnosis

1. **Red Workflow (`Deploy CineMax to GitHub Pages` — Run `#39912499190`)**
   - Failed at **Step 3: `Set up Node.js`** (`actions/setup-node@v4`).
   - `.github/workflows/deploy.yml` configured `cache: 'npm'`, which requires `package-lock.json` or `npm-shrinkwrap.json` in the repository. Because the exported repository only contains `bun.lock` and `package.json`, `actions/setup-node@v4` immediately fails before dependencies can be installed or the Vite bundle can be built.

2. **Green Workflow (`pages build and deployment`) + White Screen on Live Site**
   - GitHub's built-in `dynamic/pages/pages-build-deployment` workflow is running against the `main` branch root because **Settings → Pages → Source** is currently set to **Deploy from a branch (`main`)**.
   - As a result, `https://tosifrehan42.github.io/CineMax/` is serving the raw source `index.html` containing `<script type="module" src="/src/main.tsx"></script>` and no compiled CSS.
   - Without compiled Tailwind CSS, `<body>` has no background styles (defaulting to plain white `#ffffff`), and `<script type="module">` load failures fire on the `<script>` element rather than bubbling to `window.addEventListener('error', ...)` without capture-phase listening (`true`).

---

## Planned Changes

### 1. Fix `.github/workflows/deploy.yml` & Support Dual Deployment
- **Remove `cache: 'npm'`** from `actions/setup-node@v4` so **Step 3 (`Set up Node.js`)** succeeds cleanly without requiring `package-lock.json`.
- **Add `.nojekyll`** alongside `404.html` inside `dist/` during the build step so GitHub Pages never strips underscore-prefixed assets.
- **Dual Publishing Strategy**:
  1. **Publish `dist/` to the `gh-pages` branch** automatically on every push to `main` (using `peaceiris/actions-gh-pages@v4` with `GITHUB_TOKEN` and `contents: write` permission) so "Deploy from a branch (`gh-pages`)" works out of the box.
  2. **Upload & deploy the GitHub Pages artifact** (`actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4` with `continue-on-error: true`) so switching **Settings → Pages → Source** to **GitHub Actions** also works seamlessly.

### 2. Harden `index.html` Against White-Screen & Raw-Branch Serving
- Add inline dark background and text styles (`style="background-color: #090a0f; color: #f8fafc; margin: 0;"`) directly on `<html>` and `<body>` in `index.html` so the page never flashes or stays white if CSS fails to load.
- Upgrade the diagnostic script in `index.html` to:
  - Listen for resource/script load failures in the **capture phase** (`window.addEventListener('error', ..., true)`).
  - Detect when raw uncompiled `/src/main.tsx` is served directly by GitHub Pages (`main` branch root) and display a dark-themed setup guide explaining how to select **GitHub Actions** or the **`gh-pages` branch** under **Settings → Pages**.

### 3. Keep Browse Mode Functional Without Supabase Secrets
- Verify `src/lib/supabase.ts` and `src/contexts/AuthContext.tsx` cleanly fall back to full movie/TV discovery and local watchlist browsing when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are empty during the CI build.
