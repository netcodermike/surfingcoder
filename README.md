# SurfingCoder

A repository gallery for [surfingcoder.com](https://surfingcoder.com), featuring 346 projects across 14 languages. All Projects opens with Mathematics, followed by AI apps, data analysis, productivity, creative tools, music/audio, microservices, everyday apps, games, and Linux utilities. Function and Surface Grapher, Coinbase Ladder, and Fractal Render Lab lead their respective categories.

## Run locally

No framework, package installation, or frontend build is required. Use Python 3.10 or newer:

```powershell
python scripts/check_site.py --strict
python scripts/check_gallery.py
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000. Search, category/language filters, sorting, grid/list views, and screenshot dialogs use a small vanilla JavaScript file. Every repository card is also rendered in HTML, so browsing and GitHub links work without JavaScript.

## Edit the gallery

1. Edit `assets/projects.json`. Keep Mathematics first and projects grouped by category. Array order sets the priority within each group of featured, playable, or remaining projects.
2. Add a genuine screenshot as `assets/screenshots/<repository>.webp` and its capture metadata as `<repository>.json`. Use synthetic demonstration data. Describe terminal captures as terminal output rather than app interfaces.
3. Run `python scripts/build_gallery.py` to update the static cards and embedded data.

When you add an HTML page or change the main menu or shared theme assets, run `python scripts/build_navigation.py` to refresh the shared markup and asset versions.
4. Run both checks above, preview desktop and mobile layouts, and review `git diff` before publication.

The JSON fields are documented in [docs/gallery.md](docs/gallery.md). Layout and behavior live in `gallery.css` and `gallery.js`. Fonts use Google Fonts with system fallbacks. There are no analytics, accounts, or backend services.

## Appearance

The Theme selector in the shared header offers Dark (Amethyst & Graphite), Light (porcelain and plum), and Dusk (blue slate and lavender). Dark is the default. The browser remembers a visitor's choice using the `surfingcoder.theme` local storage key.

`navigation.css` defines the shared palettes. `theme.css` and `app-themes.css` apply them to the gallery, About page, and hosted apps. The Surf Report defines chart colors in `surfreport/style.css` so the traces, legends, and hover readouts stay legible in each theme.

Gallery screenshots remain genuine captures of their source applications; they are not recolored. Hosted app styling is maintained in this website repository independently of the standalone app repositories.

## New music, AI, and practical apps

The latest expansion adds 20 music/audio apps, 9 AI projects, a [regional surf report](https://surfingcoder.com/surfreport/), and 10 practical tools. [Browse all 40 new repositories and setup notes](docs/expansion40.md). Browser apps have **Launch app** links directly in the gallery; CLI and local-server projects link to their documented setup.

## Screenshots

The collection uses actual running app interfaces or actual command output from isolated CI runners. Native Windows, macOS, Linux, and Android captures use the scripts in `scripts/capture_*.py`. See [the screenshot guide](docs/screenshots.md) for dependencies, demo data, provenance, and refresh instructions. Captures are committed as optimized WebP images; opening a screenshot shows its provenance caption.

## Publishing

The publication branch is `main`, with GitHub Pages serving the repository root and `CNAME` set to `surfingcoder.com`. A main-branch push updates the public site. See [docs/publishing.md](docs/publishing.md) for deployment and DNS verification.

## Operations research and forecast updates

[OR Tableau Studio](https://surfingcoder.com/apps/or-tableau-studio/) adds a documented, tested simplex and farm-planning workbench. Its standalone source lives at [netcodermike/or-tableau-studio](https://github.com/netcodermike/or-tableau-studio). Refresh the hosted static copy when publishing app changes. The surf report now includes [seven-day component graphs](docs/surf-forecast-stage1.md).

## Trading indicator lab

[Trading Indicator Playground](https://surfingcoder.com/marketlab/) explains SMA, EMA, Bollinger Bands, RSI, and MACD with synthetic data and local CSV import. Its [standalone repository](https://github.com/netcodermike/trading-indicator-playground) documents formulas, numerical conventions, input limits, and tests. The hosted copy uses the shared site theme. Gallery validation now checks the large header, filter, and initial result counts against the canonical catalog.
