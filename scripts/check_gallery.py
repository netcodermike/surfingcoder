"""Validate gallery content, public repo links, and real capture provenance."""
from pathlib import Path
import json, re, html
from html.parser import HTMLParser
ROOT = Path(__file__).resolve().parents[1]
projects = json.loads((ROOT/'assets/projects.json').read_text(encoding='utf-8'))
assert len(projects) == len({p['name'] for p in projects}), 'Duplicate repository names'
category_order = ['AI & machine learning', 'Mathematics', 'Data & analysis', 'Work & productivity', 'Creative tools', 'Music & audio', 'Microservices', 'Everyday apps', 'Games & learning', 'Systems & Linux']
assert list(dict.fromkeys(p['category'] for p in projects)) == category_order, 'Curated category priorities changed'
assert [category_order.index(p['category']) for p in projects] == sorted(category_order.index(p['category']) for p in projects), 'Categories must stay grouped'
leaders = {'AI & machine learning': 'tiny-neural-network-playground', 'Mathematics': 'SvdStudio', 'Work & productivity': 'coinbase-ladder', 'Creative tools': 'fractal-render-lab', 'Music & audio': 'spectrogram-waterfall'}
for category, name in leaders.items():
    assert next(p['name'] for p in projects if p['category']==category) == name, category+': visual lead changed'
page = (ROOT/'index.html').read_text(encoding='utf-8')
for pattern, label in [
    (r'class="collection-count"[^>]*>\s*<strong[^>]*>(\d+)</strong>', 'large header count'),
    (r'All projects\s*<span[^>]*>(\d+)</span>', 'all-projects filter count'),
    (r'id="result-count"[^>]*>\s*<strong[^>]*>(\d+)</strong>', 'initial results count'),
]:
    match = re.search(pattern, page)
    assert match and int(match[1]) == len(projects), label+': rebuild gallery counts'
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
assert all(p['languages'] for p in projects), 'Every project needs a language'
language_select=re.search(r'<select id="language">(.*?)</select>',page,re.S)[1]
options={html.unescape(v) for v in re.findall(r'<option value="([^"]+)"',language_select) if v!='all'}
assert options=={language for p in projects for language in p['languages']}, 'Language filters out of sync'
for p in projects:
    if p.get('applicationUrl'):
        path=(ROOT/p['applicationUrl'].lstrip('/')/'index.html').resolve()
        assert path.is_relative_to(ROOT) and path.is_file(), p['name']+': missing launch page'
inventory=ROOT/'scripts/expansion40-inventory.json'
if inventory.exists():
    expansion=json.loads(inventory.read_text(encoding='utf-8'))
    assert len(expansion)==40 and len(projects)>=103, 'Expansion incomplete'
    assert all(any(p['name']==r['name'] for p in projects) for r in expansion), 'New app missing from gallery'

print(f'Gallery checks passed: {len(projects)} repositories, ordered cards, valid links and real screenshots.')
