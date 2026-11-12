"""Render the shared navigation into each published HTML page."""

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS_VERSION = hashlib.sha256((ROOT / 'navigation.css').read_text(encoding='utf-8').encode('utf-8')).hexdigest()[:12]
CSS_LINK = f'<link rel="stylesheet" href="/navigation.css?v={CSS_VERSION}">'
NAV_STYLESHEET = re.compile(r'<link rel="stylesheet" href="/navigation\.css(?:\?v=[a-f0-9]+)?">')
FAVICON_LINK = '<link rel="icon" type="image/png" sizes="64x64" href="/assets/surfingcoder-favicon.png">'
FAVICON_TAG = re.compile(r'<link\s+rel="(?:shortcut )?icon"[^>]*>', re.I)
START = '<!-- SITE NAVIGATION START -->'
END = '<!-- SITE NAVIGATION END -->'
NAV_BLOCK = re.compile(re.escape(START) + r'.*?' + re.escape(END), re.S)
OLD_HEADER = re.compile(r'<header class="(?:site-nav|site-header)">.*?</header>', re.S)
BODY_START = re.compile(r'<body\b[^>]*>(?:\s*<a class="skip(?:-link)?"[^>]*>[^<]*</a>)?', re.I)
LINKS = (
    ('Projects', '/#projects', 'index.html'),
    ('Surf report', '/surfreport/', 'surfreport/index.html'),
    ('Writing', '/articles/wsl-rankings-misleading.html', 'articles/wsl-rankings-misleading.html'),
    ('About', '/about.html', 'about.html'),
)
GAMES = (
    ('Cards', '/cards/', 'cards/index.html'),
    ('Pinball', '/pinball/', 'pinball/index.html'),
    ('Slots', '/slots/', 'slots/index.html'),
)


def html_pages(root=ROOT):
    return sorted(path for path in root.rglob('*.html') if not any(
        part.startswith('.') or part in {'node_modules', 'work'}
        for part in path.relative_to(root).parts))


def render_navigation(page):
    def link(item, indent):
        label, href, active_page = item
        current = ' aria-current="page"' if page == active_page else ''
        return f'{indent}<a href="{href}"{current}>{label}</a>'

    links = [
        link(LINKS[0], '      '),
        '      <details class="sc-games">',
        '        <summary>Games</summary>',
        '        <ul class="sc-games-links">',
        *(f'          <li>{link(item, "")}</li>' for item in GAMES),
        '        </ul>',
        '      </details>',
        *(link(item, '      ') for item in LINKS[1:]),
    ]
    links.append('      <a class="sc-github" href="https://github.com/netcodermike" target="_blank" '
                 'rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>')
    return '\n'.join([
        START,
        '<div class="sc-site-header" role="banner">',
        '  <div class="sc-nav-wrap">',
        '    <a class="sc-brand" href="/" aria-label="SurfingCoder home">'
        '<img class="sc-brand-mark" src="/assets/surfingcoder-mark-nav.png" alt="" width="96" height="75">'
        '<span class="sc-wordmark">Surfing<span>Coder</span></span></a>',
        '    <nav class="sc-nav-links" aria-label="Main navigation">',
        *links,
        '    </nav>',
        '  </div>',
        '</div>',
        END,
    ])


def update(source, page):
    nav = render_navigation(page)
    if NAV_BLOCK.search(source):
        updated = NAV_BLOCK.sub(lambda _: nav, source, count=1)
    elif OLD_HEADER.search(source):
        updated = OLD_HEADER.sub(lambda _: nav, source, count=1)
    else:
        updated, count = BODY_START.subn(lambda match: match[0] + '\n' + nav + '\n', source, count=1)
        if count != 1:
            raise ValueError(f'{page}: missing body tag')
        # The original app header remains the toolbar for its local controls.
        offset = updated.index(END) + len(END)
        updated = updated[:offset] + re.sub(
            r'<header(?=[\s>])', '<header role="group" aria-label="Page controls"',
            updated[offset:], count=1)
    if NAV_STYLESHEET.search(updated):
        updated = NAV_STYLESHEET.sub(CSS_LINK, updated, count=1)
    else:
        updated = updated.replace('</head>', CSS_LINK + '\n</head>', 1)
    if FAVICON_TAG.search(updated):
        updated = FAVICON_TAG.sub(FAVICON_LINK, updated, count=1)
    else:
        updated = updated.replace('</head>', FAVICON_LINK + '\n</head>', 1)
    return updated


if __name__ == '__main__':
    pages = html_pages()
    for path in pages:
        source = path.read_text(encoding='utf-8-sig')
        updated = update(source, path.relative_to(ROOT).as_posix())
        if source != updated:
            path.write_text(updated, encoding='utf-8', newline='\n')
    print(f'Updated shared navigation on {len(pages)} HTML pages.')
