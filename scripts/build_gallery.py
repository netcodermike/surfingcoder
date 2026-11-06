"""Regenerate the static project cards from assets/projects.json (Python 3.10+).

The list order is the display priority. Screenshots and descriptions stay usable
without JavaScript. No packages, network, or frontend build tools are needed.
"""
from pathlib import Path
import html, json, re
ROOT = Path(__file__).resolve().parents[1]

def esc(s):return html.escape(str(s),quote=True)
def card(p,i):
 attrs=f'data-name="{esc(p["name"])}" data-title="{esc(p["title"])}" data-category="{esc(p["category"])}" data-languages="{esc("|".join(p["languages"]))}" data-order="{i}"'
 tags=''.join('<span class="language" data-language="'+esc(l)+'"><i aria-hidden="true"></i>'+esc(l)+'</span>'for l in p['languages'])
 capture=p['capture'];label='App screenshot'if capture.get('kind')=='runtime'else'Terminal capture'if capture.get('kind')=='terminal'else'Source preview'if capture.get('kind')=='source-preview'else'Project preview'
 heading=f'<div class="card-meta"><span>{esc(p["category"])}</span>'+('<span class="featured-label">Featured</span>'if p['featured']else'')+f'</div><h2><a href="{esc(p["url"])}" target="_blank" rel="noopener noreferrer">{esc(p["title"])}<span aria-hidden="true">↗</span></a></h2>'
 return f'''<article class="project-card {'featured'if p['featured']else''}" {attrs}>
 {'<div class="featured-card-heading">'+heading+'</div>'if p['featured']else''}
 <button class="preview" data-project="{esc(p['name'])}" aria-label="Enlarge {esc(p['title'])} screenshot"><img src="{esc(p['image'])}" alt="{esc(p['title'])} — {esc(capture.get('caption','Application interface'))}" width="1200" height="780" {'fetchpriority="high"'if i<2 else'loading="lazy"'}><span class="preview-tag">{label}</span><span class="expand" aria-hidden="true">↗</span></button>
 <div class="card-body">{''if p['featured']else heading}<p class="description">{esc(p['description'])}</p><div class="card-footer"><div class="languages">{tags}</div><a class="repo-link" href="{esc(p['url'])}" target="_blank" rel="noopener noreferrer">View repository <span aria-hidden="true">↗</span></a></div></div></article>'''

def build():
    projects = json.loads((ROOT/'assets/projects.json').read_text(encoding='utf-8'))
    assert len({p['name'] for p in projects}) == len(projects), 'Duplicate repository'
    page = (ROOT/'index.html').read_text(encoding='utf-8')
    cards = '\n'.join(card(p, i) for i, p in enumerate(projects))
    page, count = re.subn(r'<!-- PROJECT_CARDS_START -->.*?<!-- PROJECT_CARDS_END -->', lambda m: '<!-- PROJECT_CARDS_START -->\n'+cards+'\n<!-- PROJECT_CARDS_END -->', page, flags=re.S)
    assert count == 1, 'Missing project card markers'
    data = json.dumps(projects, ensure_ascii=False).replace('</', '<\\/')
    page, count = re.subn(r'(<script type="application/json" id="project-data">).*?(</script>)', lambda m: m[1]+data+m[2], page, flags=re.S)
    assert count == 1, 'Missing embedded project data'
    total = str(len(projects))
    page = re.sub(r'(class="collection-count"><strong>)\d+', lambda m: m[1]+total, page)
    page = re.sub(r'(All projects <span>)\d+', lambda m: m[1]+total, page)
    page = re.sub(r'(id="result-count" aria-live="polite"><strong>)\d+', lambda m: m[1]+total, page)
    page = re.sub(r'Explore \d+ software projects', 'Explore '+total+' software projects', page)
    page = '\n'.join(line.rstrip() for line in page.splitlines())+'\n'
    (ROOT/'index.html').write_bytes(page.encode('utf-8'))
    print(f'Rendered {len(projects)} repositories from assets/projects.json')

if __name__ == '__main__':
    build()
