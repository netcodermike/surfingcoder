# SurfingCoder

A repository gallery for [surfingcoder.com](https://surfingcoder.com), featuring 103 projects across 13 languages. SVD Studio and Coinbase Ladder lead the collection, followed by Fractal Render Lab and the music/audio apps. Professional tools, Linux utilities, creative apps, and learning projects complete the gallery.

## Run locally

No framework, package installation, or frontend build is required. Use Python 3.10 or newer:

```powershell
python scripts/check_site.py --strict
python scripts/check_gallery.py
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000. Search, category/language filters, sorting, grid/list views, and screenshot dialogs use a small vanilla JavaScript file. Every repository card is also rendered in HTML, so browsing and GitHub links work without JavaScript.

## Edit the gallery

1. Edit `assets/projects.json`. Array order sets the default display priority; keep SvdStudio and coinbase-ladder first.
2. Add a genuine screenshot as `assets/screenshots/<repository>.webp` and its capture metadata as `<repository>.json`. Use synthetic demonstration data. Describe terminal captures as terminal output rather than app interfaces.
3. Run `python scripts/build_gallery.py` to update the static cards and embedded data.
4. Run both checks above, preview desktop and mobile layouts, and review `git diff` before publication.

The JSON fields are documented in [docs/gallery.md](docs/gallery.md). Layout and behavior live in `gallery.css` and `gallery.js`. Fonts use Google Fonts with system fallbacks. There are no analytics, accounts, or backend services.

## New music, AI, and practical apps

The latest expansion adds 20 music/audio apps, 9 AI projects, a [regional surf report](https://surfingcoder.com/surfreport/), and 10 practical tools. [Browse all 40 new repositories and setup notes](docs/expansion40.md). Browser apps have **Launch app** links directly in the gallery; CLI and local-server projects link to their documented setup.

## Screenshots

The collection uses actual running app interfaces or actual command output from isolated CI runners. Native Windows, macOS, Linux, and Android captures use the scripts in `scripts/capture_*.py`. See [the screenshot guide](docs/screenshots.md) for dependencies, demo data, provenance, and refresh instructions. Captures are committed as optimized WebP images; opening a screenshot shows its provenance caption.

## Publishing

The publication branch is `main`, with GitHub Pages serving the repository root and `CNAME` set to `surfingcoder.com`. A main-branch push updates the public site. See [docs/publishing.md](docs/publishing.md) for deployment and DNS verification.

## Writing

The existing [Pipeline title-race analysis](articles/wsl-rankings-misleading.html), its supporting data, and the About page remain available. The article retains its November 3, 2026 snapshot and review-draft context.
