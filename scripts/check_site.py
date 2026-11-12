"""Dependency-free publication checks for this static site.

Default mode reports unfinished draft problems. --strict makes them block publication.
This checks local HTML and assets; it does not claim to validate external links or DNS.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

from build_navigation import CSS_LINK, NAV_BLOCK, html_pages, render_navigation

ROOT = Path(__file__).resolve().parent.parent


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.ids = set()
        self.tags = set()
        self.lang = False
        self.viewport = False
        self.image_issues = 0

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        self.tags.add(tag)
        if values.get('id'):
            self.ids.add(values['id'])
        if tag == 'html':
            self.lang = bool(values.get('lang'))
        if tag == 'meta' and values.get('name', '').lower() == 'viewport':
            self.viewport = True
        if tag == 'img' and 'alt' not in values:
            self.image_issues += 1
        for key in ('href', 'src'):
            if values.get(key):
                self.refs.append(values[key])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--strict', action='store_true', help='Fail on unfinished draft problems.')
    args = parser.parse_args()
    paths = html_pages(ROOT)
    issues = []
    pages = {}
    if ROOT / 'index.html' not in paths:
        issues.append('index.html: missing site entry page')
    for path in paths:
        rel = path.relative_to(ROOT).as_posix()
        try:
            source = path.read_text(encoding='utf-8-sig')
        except UnicodeError:
            issues.append(f'{rel}: file must be UTF-8')
            continue
        if NAV_BLOCK.findall(source) != [render_navigation(rel)] or source.count(CSS_LINK) != 1:
            issues.append(f'{rel}: shared navigation is out of date; run scripts/build_navigation.py')
        page = Page()
        page.feed(source)
        pages[path] = page
        for tag in ('html', 'head', 'title', 'body'):
            if tag not in page.tags:
                issues.append(f'{rel}: missing <{tag}> document element')
        if not page.lang:
            issues.append(f'{rel}: missing document language')
        if not page.viewport:
            issues.append(f'{rel}: missing mobile viewport')
        if page.image_issues:
            issues.append(f'{rel}: {page.image_issues} image(s) missing alt attributes')
    for path, page in pages.items():
        rel = path.relative_to(ROOT).as_posix()
        for ref in page.refs:
            url = urlsplit(ref)
            if url.scheme or url.netloc:
                continue
            target = ((ROOT / unquote(url.path).lstrip('/')) if url.path.startswith('/')
                      else (path.parent / unquote(url.path))) if url.path else path
            target = target.resolve()
            if not target.is_relative_to(ROOT):
                issues.append(f'{rel}: link leaves the site directory: {ref}')
                continue
            if target.is_dir():
                target /= 'index.html'
            if not target.is_file():
                issues.append(f'{rel}: missing local link or asset: {ref}')
            elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
                issues.append(f'{rel}: missing anchor: {ref}')
    print(f'Checked {len(paths)} HTML page(s). External links, rendering, authentication and DNS are not checked.')
    if issues:
        print('\nPublication issues:')
        for issue in issues:
            print(f'- {issue}')
        if args.strict:
            print('\nPublication check failed. Resolve these issues before publishing.')
            return 1
        print('\nDraft report complete. Run with --strict before publishing.')
    else:
        print('Local publication checks passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
