# 🛠️ BoschDreams 7V — Technical & Repository Guide

> **Back to main showcase:** [`README.md`](./README.md)  
> **Live Webpage:** https://jiangchaokang.github.io/boschdreams-7v-report/ (Password: `boschdreams`)

This document covers the repository architecture, build/encryption tooling, deployment workflow, and practical tips for maintaining and updating the **BoschDreams 7V** technical report site.

---

## 📂 Repository Architecture

<!-- TODO: Update the tree below to match your exact filenames and script paths -->

```text
boschdreams-7v-report/
├── README.md                              # Reader-facing project overview, links & highlights
├── DOCS.md                                # Technical documentation, architecture & maintainer tips (this file)
├── index.html                             # Protected GitHub Pages entrypoint (AES-256 password gate)
├── assets/
│   ├── BoschDreams-technical-report.pdf   # Full technical report PDF (12.1 MB)
│   ├── videos/                            # 7-view demo videos (compressed MP4/WebM)
│   └── images/                            # Teaser figures, architecture diagrams, comparison grids
├── src/                                   # Unencrypted source HTML/CSS/JS templates (if tracked/local)
└── scripts/                               # Automation & build utilities
    ├── encrypt.py / encrypt.js            # AES-256 payload encryption script
    └── compress_media.sh                  # Video/image optimization helper
```

### Design Overview

1. **Static GitHub Pages Delivery:** The report is served as a zero-backend static site on GitHub Pages (`https://jiangchaokang.github.io/boschdreams-7v-report/`).
2. **Client-Side AES-256 Gate:** The landing page (`index.html`) validates the access password locally in the browser and decrypts the protected report payload on the fly, with an optional 7-day local persistence toggle (*"Remember password for 7 days"*).
3. **Decoupled Assets:** Heavy media assets and the technical report PDF live under `assets/` so they can be versioned, linked, or cached cleanly.

---

## 🚀 Usage & Tooling

### 1. Local Development & Preview

Serve the repository locally to test the password gate, video playback, and responsive layout before pushing:

```bash
# Option A: Python built-in HTTP server
python3 -m http.server 8000

# Option B: Node.js serve
npx serve .
```

Open `http://localhost:8000` in your browser and unlock using the configured password (`boschdreams`).

### 2. Building & Encrypting the Report

<!-- TODO: Replace with your exact encryption command / flags (e.g., StaticCrypt or custom script) -->

```bash
# Example workflow: rebuild and encrypt the report HTML
# Replace with the actual command used in your repository:
python scripts/encrypt.py \
  --input src/report.html \
  --output index.html \
  --password "boschdreams"
```

### 3. Updating the Technical Report PDF

To publish a revised PDF without breaking external links:

1. Overwrite `assets/BoschDreams-technical-report.pdf` keeping the **exact filename**.
2. Verify the file size stays comfortably under GitHub's soft/hard repository limits (recommended `< 25 MB`, hard limit `100 MB`).
3. Commit and push to `main`:
   ```bash
   git add assets/BoschDreams-technical-report.pdf
   git commit -m "docs: update BoschDreams technical report PDF"
   git push origin main
   ```

---

## 💡 Practical Tips & "Tricks"

### 🎥 Multi-View Video Optimization (7-Camera Grids)
7-camera layouts can quickly bloat repository size and stall browser playback. Use H.264 with `faststart` enabled so videos begin streaming immediately:

```bash
ffmpeg -i raw_7v_demo.mp4 \
  -vcodec libx264 -crf 24 -preset slow \
  -pix_fmt yuv420p -movflags +faststart \
  -an assets/videos/demo_optimized.mp4
```

- **Tip 1 (`-movflags +faststart`):** Moves the `moov` atom to the beginning of the MP4 file for instant web playback.
- **Tip 2 (`-an`):** Strips unused audio tracks to save bandwidth and enable reliable muted autoplay in modern browsers.
- **Tip 3 (Lazy Loading):** Set `preload="metadata"` or use an `IntersectionObserver` on off-screen `<video>` elements so all 7V clips don't compete for bandwidth simultaneously upon decryption.

### 📄 PDF Size & Quality Balance
If a new draft of `BoschDreams-technical-report.pdf` grows too large due to high-DPI figures, compress it cleanly with Ghostscript while keeping vector text crisp:

```bash
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 \
   -dPDFSETTINGS=/printer -dNOPAUSE -dQUIET -dBATCH \
   -sOutputFile=assets/BoschDreams-technical-report.pdf \
   raw_report.pdf
```
*(Use `/ebook` for smaller file sizes ~5–10 MB, or `/printer` for sharper figure details.)*

### 🔐 Password & Caching Hygiene
- **Rotating the password:** Update the password in your encryption build step, regenerate `index.html`, and update the Quick Access callout in `README.md`.
- **Testing password changes:** Because the login page supports *"Remember password for 7 days"*, always verify changes in an **Incognito/Private window** or clear `localStorage` / cookies for `jiangchaokang.github.io`.
- **GitHub Pages cache:** After pushing to `main`, allow 1–2 minutes for the GitHub Pages workflow to complete and perform a hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`).

### 🧹 Git History & Binary Bloat Prevention
- Avoid repeatedly committing large raw videos or multi-version PDFs directly to `main`; if replacing large binaries often, consider using `git lfs` or hosting archival media as **GitHub Release assets** (note: GitHub Pages serves regular repo files directly, whereas Release asset URLs can be embedded as external `<video src="...">` links).

---

## 🐛 Troubleshooting

| Issue | Likely Cause | Fix |
| :--- | :--- | :--- |
| **"Incorrect password" after updating site** | Browser cached old encrypted bundle or stale `localStorage` token | Hard-refresh (`Ctrl+Shift+R`) and clear site storage for `jiangchaokang.github.io` |
| **Videos won't autoplay on mobile/Chrome** | Missing `muted` or `playsinline` attributes | Ensure `<video autoplay loop muted playsinline>` is set |
| **PDF fails to preview on GitHub** | File size or iframe viewer limitation | Provide both the GitHub blob link and the `raw.githubusercontent.com` direct download link (already included in `README.md`) |
| **404 on GitHub Pages** | Deployment action still running or wrong branch configured | Check **Settings → Pages** (`Deploy from branch: main / root`) and inspect the **Actions** tab |
