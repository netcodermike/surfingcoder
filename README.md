# SurfingCoder

Projects, analysis, and ideas worth exploring. A responsive, ocean-inspired personal website and blog built with plain HTML, CSS, and JavaScript. No dependencies or build step.

## Preview locally

Open `index.html` directly in a browser, or serve the repository with Python:

```sh
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish on GitHub Pages

In **Settings → Pages**, choose **Deploy from a branch**, select the branch containing the website, and select **/ (root)**. All internal links and assets use relative paths, so the site works at both a project URL such as `https://netcodermike.github.io/surfingcoder/` and a custom domain. `.nojekyll` keeps the files served as a plain static site.

## Structure

```text
index.html                  Home
about.html                  About
contact.html                Contact
articles/
  index.html                Article listing
  wsl-rankings.html          Sample article
  pipeline-title-scenarios.html
  requalification-battle.html
assets/
  css/style.css             Shared responsive dark theme
  js/main.js                Accessible mobile navigation and footer year
  favicon.svg
  images/ocean.svg           Original ocean illustration
```

## Add an article

1. Copy an existing article HTML file within `articles/`.
2. Update the title, description, Open Graph metadata, heading, category, reading time, and body. Keep one `h1` and the shared header, footer, stylesheet, and script references.
3. Add a card linking to it in `articles/index.html`. To feature it, also add or replace a card in `index.html`.
4. Update the “Keep exploring” link and check navigation at desktop and mobile widths.

The initial essays contain clearly labeled fictional examples, not live WSL data. Social links intentionally point to platform homepages until personal profile URLs are supplied. Replace those links in each footer and on the contact page, and add a real contact method before publishing contact details.

## Accessibility and verification

The site includes a skip link, visible keyboard focus, semantic landmarks, a keyboard-operable mobile menu, and reduced-motion support. Navigation remains available without JavaScript. There is no existing automated test or build infrastructure; verify the pages in a browser and check that all relative links and assets resolve before publishing.
