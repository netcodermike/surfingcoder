# SurfingCoder

A repository gallery for [surfingcoder.com](https://surfingcoder.com), featuring 125 projects across 13 languages. AI apps lead the collection, followed by data analysis, productivity, creative tools, music/audio, microservices, everyday apps, games, and Linux utilities. Each category opens with its strongest visual interfaces. SVD Studio, Coinbase Ladder, and Fractal Render Lab lead their respective categories.

## Run locally

No framework, package installation, or frontend build is required. Use Python 3.10 or newer:

```powershell
python scripts/check_site.py --strict
python scripts/check_gallery.py
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000. Search, category/language filters, sorting, grid/list views, and screenshot dialogs use a small vanilla JavaScript file. Every repository card is also rendered in HTML, so browsing and GitHub links work without JavaScript.

## Edit the gallery

1. Edit `assets/projects.json`. Array order sets the default display priority; keep AI first and projects grouped by category, with the strongest screenshots first in each group.
2. Add a genuine screenshot as `assets/screenshots/<repository>.webp` and its capture metadata as `<repository>.json`. Use synthetic demonstration data. Describe terminal captures as terminal output rather than app interfaces.
3. Run `python scripts/build_gallery.py` to update the static cards and embedded data.
4. Run both checks above, preview desktop and mobile layouts, and review `git diff` before publication.

The JSON fields are documented in [docs/gallery.md](docs/gallery.md). Layout and behavior live in `gallery.css` and `gallery.js`. Fonts use Google Fonts with system fallbacks. There are no analytics, accounts, or backend services.

## Appearance

Every HTML page loads `theme.css`, the shared **Amethyst & Graphite** palette: `#18161E` background, `#27222F` panels, `#A879E8` purple accents, `#D9C4F5` metallic highlights, and soft off-white text. Edit its CSS variables to keep the gallery, writing, About page, surf report, and hosted apps consistent. `app.css` holds shared app layouts; each hosted app's `style.css` imports it. Canvas charts read the same theme variables through the `theme()` helper in `ui.js`.

Gallery screenshots remain genuine captures of their source applications; they are not recolored. Hosted app styling is maintained in this website repository independently of the standalone app repositories.

## New music, AI, and practical apps

The latest expansion adds 20 music/audio apps, 9 AI projects, a [regional surf report](https://surfingcoder.com/surfreport/), and 10 practical tools. [Browse all 40 new repositories and setup notes](docs/expansion40.md). Browser apps have **Launch app** links directly in the gallery; CLI and local-server projects link to their documented setup.

## Screenshots

The collection uses actual running app interfaces or actual command output from isolated CI runners. Native Windows, macOS, Linux, and Android captures use the scripts in `scripts/capture_*.py`. See [the screenshot guide](docs/screenshots.md) for dependencies, demo data, provenance, and refresh instructions. Captures are committed as optimized WebP images; opening a screenshot shows its provenance caption.

## Publishing

The publication branch is `main`, with GitHub Pages serving the repository root and `CNAME` set to `surfingcoder.com`. A main-branch push updates the public site. See [docs/publishing.md](docs/publishing.md) for deployment and DNS verification.

## Writing

The existing [Pipeline title-race analysis](articles/wsl-rankings-misleading.html), its supporting data, and the About page remain available. The published article retains its November 3, 2026 snapshot and explicit assumptions.

## Operations research and forecast updates

[OR Tableau Studio](https://surfingcoder.com/apps/or-tableau-studio/) adds a documented, tested simplex and farm-planning workbench. Its standalone source lives at [netcodermike/or-tableau-studio](https://github.com/netcodermike/or-tableau-studio). Refresh the hosted static copy when publishing app changes. The surf report now includes [seven-day component graphs](docs/surf-forecast-stage1.md). The Pipeline article retains its original snapshot, with [November 9 verification notes](docs/article-review-2026-11-09.md).

## Trading indicator lab

[Trading Indicator Playground](https://surfingcoder.com/marketlab/) explains SMA, EMA, Bollinger Bands, RSI, and MACD with synthetic data and local CSV import. Its [standalone repository](https://github.com/netcodermike/trading-indicator-playground) documents formulas, numerical conventions, input limits, and tests. The hosted copy uses the shared site theme. Gallery validation now checks the large header, filter, and initial result counts against the canonical catalog.
