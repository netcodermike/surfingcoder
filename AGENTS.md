# SurfingCoder project

This is the source repository for https://surfingcoder.com.
Owner: netcodermike. Remote: https://github.com/netcodermike/surfingcoder.git.

## Working on this site

- Preserve the simple static HTML architecture. No framework or build step is required.
- Start by checking Git status and fetching the remote when network access is available.
- Keep unfinished work on a topic branch. `main` is the intended publication branch.
- Before publishing, run `python scripts/check_site.py --strict` and review the actual diff.
- Preview with `python -m http.server 8000 --bind 127.0.0.1` from this folder.
- A push to the configured GitHub Pages source can update the public website. Explain that effect when discussing publication.
- Never place credentials, personal tokens, private account exports, or DNS account credentials in site files, commits, or chat.
- Use established GitHub authentication or its connected plugin. Do not ask the user to paste a token into chat.

## Editorial context

- SurfingCoder covers software, data analysis, AI experiments, surfing, and related interests.
- The WSL article is a complete review draft. Keep the November 3, 2026 snapshot and its normal-participation assumptions explicit.
- For surfing analysis, use official rules and timestamped official event results.
- Distinguish exact points conditions from paths that depend on the eventual draw, entry list, withdrawals, or wildcard decisions.
- Explain dropped-result arithmetic and use the exact published points table, including rounding.

See docs/publishing.md for local setup, authentication, GitHub Pages, and DNS instructions.

## Publication status

On November 6, 2026, the user explicitly authorized making this repository public and activating surfingcoder.com with the repository gallery as its homepage. The gallery must be visible immediately on landing, with SvdStudio and coinbase-ladder first. The latest curation request places fractal-render-lab third, followed by the music/audio apps, then other professional tools. Preserve existing writing and its snapshot context. See docs/publishing.md for the deployment source.
