# Gallery content and behavior

`assets/projects.json` is the canonical content source. Run `python scripts/build_gallery.py` after editing it; the generator updates only the marked card block, embedded JSON, and displayed repository counts in `index.html`. It does not require network access or third-party packages.

| Field | Purpose |
| --- | --- |
| `name` | Exact GitHub repository name; unique stable key |
| `title` | Human-readable card heading |
| `description` | Plain-text summary of the actual project |
| `url` | Public GitHub repository URL |
| `languages` | Array of languages matching the filter options |
| `platform` | Platforms included in keyword searches |
| `category` | One of the nine category filters |
| `featured` | Whether to use the larger featured card treatment |
| `order` | Historical curation metadata; array order controls display |
| `image` | Local WebP screenshot path |
| `capture` | Capture metadata including `kind`, `caption`, date, and demo-data flag |
| `applicationUrl` | Optional same-site browser app path used by the Launch app link |
| `ci` | Link to source build or validation history |

Keep projects grouped in this curated order: AI & machine learning, Data & analysis, Work & productivity, Creative tools, Music & audio, Microservices, Everyday apps, Games & learning, Systems & Linux. Within each category, lead with visually compelling, colorful runtime screenshots before text-heavy and terminal captures. Tiny Neural Network Playground and Decision Tree Workbench open the AI group; SVD Studio, Coinbase Ladder, and Fractal Render Lab lead their respective categories. Category filter buttons follow the same order. New categories/languages require corresponding controls in `index.html` as well as CSS color rules if desired.

Search matches title, description, name, category, language, and platform. Filters combine, and sorting changes only the display order. The URL stores search/filter/sort state for sharing. Grid/list preference is stored locally; storage failures are tolerated. The initial HTML includes every card for progressive enhancement.

Screenshots open in a native dialog with keyboard focus management and Escape support. Buttons and controls have accessible names, result counts announce changes, images include descriptive alternatives, and reduced-motion preferences are respected.

Before publication, check mobile overflow, keyboard navigation, empty search/reset, combined filters, both layouts, and an enlarged screenshot. Run `python scripts/check_site.py --strict`, `python scripts/check_gallery.py`, and `git diff --check`.
