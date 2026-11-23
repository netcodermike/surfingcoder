"""Render the shared header and footer into each published HTML page."""

import hashlib
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS_VERSION = hashlib.sha256((ROOT / 'navigation.css').read_text(encoding='utf-8').encode('utf-8')).hexdigest()[:12]
CSS_LINK = f'<link rel="stylesheet" href="/navigation.css?v={CSS_VERSION}">'
NAV_STYLESHEET = re.compile(r'<link rel="stylesheet" href="/navigation\.css(?:\?v=[a-f0-9]+)?">')
CAM_SCRIPT_VERSION = hashlib.sha256((ROOT / 'surf-cams.js').read_text(encoding='utf-8').encode('utf-8')).hexdigest()[:12]
CAM_SCRIPT = f'<script defer src="/surf-cams.js?v={CAM_SCRIPT_VERSION}"></script>'
FAVICON_LINK = '<link rel="icon" type="image/png" sizes="64x64" href="/assets/surfingcoder-favicon.png?v=20261118-clear">'
FAVICON_TAG = re.compile(r'<link\s+rel="(?:shortcut )?icon"[^>]*>', re.I)
START = '<!-- SITE NAVIGATION START -->'
END = '<!-- SITE NAVIGATION END -->'
NAV_BLOCK = re.compile(re.escape(START) + r'.*?' + re.escape(END), re.S)
FOOTER_START = '<!-- SITE FOOTER START -->'
FOOTER_END = '<!-- SITE FOOTER END -->'
FOOTER_BLOCK = re.compile(re.escape(FOOTER_START) + r'.*?' + re.escape(FOOTER_END), re.S)
FOOTER = '\n'.join([
    FOOTER_START,
    '<footer class="sc-site-footer">',
    '  <div class="sc-footer-wrap">',
    '    <a href="/">SurfingCoder / Stay curious. Build something.</a>',
    '    <span>© 2026</span>',
    '  </div>',
    '</footer>',
    FOOTER_END,
])
OLD_HEADER = re.compile(r'<header class="(?:site-nav|site-header)">.*?</header>', re.S)
BODY_START = re.compile(r'<body\b[^>]*>(?:\s*<a class="skip(?:-link)?"[^>]*>[^<]*</a>)?', re.I)
LINKS = (
    ('Projects', '/#projects', 'index.html'),
    ('Surf Report', '/surfreport/', 'surfreport/index.html'),
    ('About', '/about.html', 'about.html'),
)
def game_links():
    projects = json.loads((ROOT / 'assets/projects.json').read_text(encoding='utf-8'))
    links = []
    for project in projects:
        if not (label := project.get('gameMenuLabel')):
            continue
        href = project['applicationUrl']
        if not href.startswith('/') or not href.endswith('/') or href.startswith('//'):
            raise ValueError(f'{label}: game links must use a local directory URL')
        links.append((label, href, href.lstrip('/') + 'index.html'))
    if len({href for _, href, _ in links}) != len(links):
        raise ValueError('Duplicate game links')
    return tuple(sorted(links, key=lambda item: item[0].casefold()))


GAMES = game_links()
GUITAR = (
    ('Blues Progression Atlas', '/apps/blues-progression-atlas/', 'apps/blues-progression-atlas/index.html'),
    ('Chord Voicing Lab', '/apps/chord-voicing-lab/', 'apps/chord-voicing-lab/index.html'),
    ('Guitar Chord Workshop', '/guitar-chords/', 'guitar-chords/index.html'),
    ('Guitar Tuner', '/guitar-tuner/', 'guitar-tuner/index.html'),
)

# Follow the coastline from Virginia Beach to Wrightsville Beach.
SURF_CAMS = (
    ('Atlantic Park Surf · Virginia Beach', 'https://atlanticparksurf.com/aps-live-cam', 'atlantic-park-surf'),
    ('Jennette’s Pier · NC Aquariums', 'https://www.ncaquariums.com/current-conditions', 'nc-aquariums'),
    ('Jennette’s Pier · SurfChex', 'https://surfchex.com/cams/nags-head-web-cam/', 'surfchex'),
    ('Atlantic Beach · ABLiveSurf', 'https://www.ablivesurf.com/livecams/', 'live-surf'),
    ('Pine Knoll Shores · Atlantis Lodge', 'https://atlantislodge.com/webcam/', 'atlantis-lodge'),
    ('Emerald Isle · Eastern Beach Access',
     'https://www.emeraldisle-nc.org/268/Eastern-Ocean-Regional-Access-Beach-Came', 'emerald-isle'),
    ('Bogue Inlet Pier · Pier Cam', 'https://www.ebmcdn.net/webcast/flash/bogue-inlet/live-iframe-jsobf.html',
     'bogue-inlet-pier'),
    ('Bogue Inlet Pier · EILiveSurf', 'https://www.eilivesurf.com/livecams/', 'live-surf'),
    ('Emerald Isle · Western Beach Access',
     'https://www.emeraldisle-nc.org/275/Western-Ocean-Regional-Access-Beach-Came', 'emerald-isle'),
    ('North Topsail Beach', 'https://surfchex.com/cams/north-topsail-island-web-cam/', 'surfchex'),
    ('Surf City Pier · North', 'https://surfchex.com/cams/surf-city-pier-north/', 'surfchex'),
    ('Surf City Pier · South', 'https://surfchex.com/cams/surf-city-pier-south/', 'surfchex'),
    ('Wrightsville Beach', 'https://surfchex.com/cams/wrightsville-beach/', 'surfchex'),
)


def html_pages(root=ROOT):
    return sorted(path for path in root.rglob('*.html') if not any(
        part.startswith('.') or part in {'node_modules', 'work'}
        for part in path.relative_to(root).parts))


def render_navigation(page):
    is_arcade = page.startswith('arcade/')

    def link(item, indent):
        label, href, active_page = item
        active = page == active_page or (active_page == 'arcade/index.html' and is_arcade)
        current = ' aria-current="page"' if active else ''
        return f'{indent}<a href="{escape(href)}"{current}>{escape(label)}</a>'

    def dropdown(label, slug, anchors):
        return [
            f'      <details class="sc-dropdown sc-{slug}" name="surfingcoder-menu">',
            f'        <summary>{label}</summary>',
            f'        <ul class="sc-dropdown-links sc-{slug}-links">',
            *(f'          <li>{anchor}</li>' for anchor in anchors),
            '        </ul>',
            '      </details>',
        ]

    links = [
        link(LINKS[0], '      '),
        *dropdown('Games', 'games', (link(item, '') for item in GAMES)),
        *dropdown('Guitar', 'guitar', (link(item, '') for item in GUITAR)),
        *dropdown('Surf Cams', 'surf-cams', (
            f'<a href="{escape(href)}" target="_blank" rel="noopener noreferrer">'
            f'<img class="sc-cam-icon" src="/assets/surf-cam-icons/{escape(icon)}.png" '
            f'alt="" width="22" height="22" loading="lazy">{escape(label)}</a>'
            for label, href, icon in SURF_CAMS
        )),
        link(LINKS[1], '      '),
        link(LINKS[2], '      '),
    ]
    return '\n'.join([
        START,
        '<div class="sc-site-header" role="banner">',
        '  <div class="sc-nav-wrap">',
        '    <a class="sc-brand" href="/" aria-label="SurfingCoder home">'
        '<img class="sc-brand-mark" src="/assets/surfingcoder-mark-nav.png" alt="" width="96" height="75">'
        '<span class="sc-wordmark">Surfing<span>Coder</span>'
        + ('<small class="sc-arcade-label">THE ARCADE</small>' if is_arcade else '')
        + '</span></a>',
        '    <nav class="sc-nav-links" aria-label="Main navigation">',
        *links,
        '    </nav>',
        '  </div>',
        '</div>',
        CAM_SCRIPT,
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
    if FOOTER_BLOCK.search(updated):
        updated = FOOTER_BLOCK.sub(lambda _: FOOTER, updated, count=1)
    else:
        updated, count = re.subn(r'</body\s*>', lambda match: '\n' + FOOTER + '\n' + match[0],
                                 updated, count=1, flags=re.I)
        if count != 1:
            raise ValueError(f'{page}: missing closing body tag')
    return updated


if __name__ == '__main__':
    pages = html_pages()
    for path in pages:
        source = path.read_text(encoding='utf-8-sig')
        updated = update(source, path.relative_to(ROOT).as_posix())
        if source != updated:
            path.write_text(updated, encoding='utf-8', newline='\n')
    print(f'Updated shared header and footer on {len(pages)} HTML pages.')
