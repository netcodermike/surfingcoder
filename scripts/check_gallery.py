"""Validate gallery content, public repo links, and real capture provenance."""
from pathlib import Path
import json, re
from html.parser import HTMLParser
ROOT = Path(__file__).resolve().parents[1]
projects = json.loads((ROOT/'assets/projects.json').read_text(encoding='utf-8'))
assert len(projects) == len({p['name'] for p in projects}), 'Duplicate repository names'
assert [p['name'] for p in projects[:2]] == ['SvdStudio', 'coinbase-ladder'], 'Featured priorities changed'
page = (ROOT/'index.html').read_text(encoding='utf-8')
embedded = re.search(r'<script type="application/json" id="project-data">(.*?)</script>', page, re.S)
assert embedded and json.loads(embedded[1].replace('<\\/', '</')) == projects, 'Rebuild static gallery data'
class Cards(HTMLParser):
    def __init__(self): super().__init__(); self.names=[]
    def handle_starttag(self, tag, attrs):
        values=dict(attrs)
        if tag == 'article' and 'project-card' in values.get('class','').split(): self.names.append(values['data-name'])
cards=Cards(); cards.feed(page)
assert cards.names == [p['name'] for p in projects], 'Rebuild the static cards'
for p in projects:
    assert p['url'] == 'https://github.com/netcodermike/'+p['name'], p['name']+': unexpected repository URL'
    assert p['description'].strip() and not p['description'].startswith(('[!', '**')), p['name']+': invalid description'
    image=(ROOT/p['image']).resolve()
    assert image.is_relative_to(ROOT) and image.is_file() and image.suffix == '.webp', p['name']+': invalid screenshot'
    assert 100 < image.stat().st_size < 500000, p['name']+': screenshot size out of bounds'
    metadata=json.loads(image.with_suffix('.json').read_text(encoding='utf-8'))
    assert metadata == p['capture'], p['name']+': capture metadata differs'
    assert metadata['kind'] in ('runtime','terminal'), p['name']+': capture needs to be completed'
    assert metadata.get('caption'), p['name']+': missing capture description'
assert len({language for p in projects for language in p['languages']}) == 10, 'Update language controls and count'
print(f'Gallery checks passed: {len(projects)} repositories, ordered cards, valid links and real screenshots.')
