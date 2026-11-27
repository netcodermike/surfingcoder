(()=>{'use strict';const $=id=>document.getElementById(id),grid=$('project-grid'),cards=[...grid.querySelectorAll('.project-card')],projects=JSON.parse($('project-data').textContent),lookup=new Map(projects.map(p=>[p.name,p]));
const defaultCategory = 'all';
let category=defaultCategory,view='grid';
const params=new URLSearchParams(location.search);
const requestedCategory = params.get('category');
$('search').value=params.get('q')||'';if([...$('language').options].some(o=>o.value===params.get('language')))$('language').value=params.get('language');if([...$('sort').options].some(o=>o.value===params.get('sort')))$('sort').value=params.get('sort');if([...document.querySelectorAll('.filter-chip')].some(b=>b.dataset.category===requestedCategory))category=requestedCategory;
try{view=params.get('view')||localStorage.getItem('surfingcoder-view')||'grid';}catch{}if(!['grid','list'].includes(view))view='grid';
const gamesCategory = 'Games & learning';
const orderedCategories = [...new Set(projects.map(project => project.category))];
const categoryPositions = new Map(orderedCategories.map((name, position) => [name, position]));

function curatedOrder(card, project) {
  const order = Number(card.dataset.order);
  if (category !== gamesCategory) return order;
  return project.gamesOrder ?? (projects.length + order);
}

function curatedPriority(project) {
  if (project.featured) return 0;
  return project.applicationUrl ? 1 : 2;
}

function compareCurated(a, b) {
  const left = lookup.get(a.dataset.name);
  const right = lookup.get(b.dataset.name);
  if (category === 'all' && left.category !== right.category) {
    return categoryPositions.get(left.category) - categoryPositions.get(right.category);
  }
  return curatedPriority(left) - curatedPriority(right) || curatedOrder(a, left) - curatedOrder(b, right);
}
function matchesCategory(project) {
  return category === 'all' || project.category === category ||
    (category === gamesCategory && project.gameMenuLabel && project.gamesListed !== false);
}

function initPreviewAnimations(dialog) {
  const dialogPreview = $('dialog-preview');
  const dialogButton = $('dialog-motion-toggle');
  if (!dialogPreview || !dialogButton || typeof IntersectionObserver !== 'function') return () => {};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const previews = new Map();
  let active;
  const wantsMotion = state => state.choice ?? !reducedMotion.matches;
  const inView = state => !document.hidden &&
    (dialog.open ? active === state : state.visible && !state.card.hidden);
  const shouldPlay = state => inView(state) && wantsMotion(state) && !state.failed;

  function updateButton(button, state) {
    button.hidden = !state || state.failed;
    if (!state) return;
    button.textContent = wantsMotion(state) ? 'Pause motion' : 'Play motion';
    button.setAttribute('aria-label', `${button.textContent} for ${state.project.title}`);
  }

  function updatePreview(state) {
    const { preview, video, button } = state;
    const host = dialog.open && state === active ? dialogPreview : preview;
    // Moving the same video keeps its frame and playback position in either view.
    if (video.parentElement !== host) {
      video.parentElement.classList.remove('is-animated');
      host.firstElementChild.after(video);
    }
    const play = shouldPlay(state);
    const hasVisibleFrame = inView(state) && state.hasFrame && !state.failed;
    host.classList.toggle('is-animated', hasVisibleFrame);
    video.hidden = !play && !hasVisibleFrame;
    if (play) {
      if (!video.hasAttribute('src')) video.src = state.source;
      if (video.paused) video.play().catch(error => {
        if (!shouldPlay(state) || error.name === 'AbortError') return;
        if (error.name === 'NotAllowedError') state.choice = false;
        else state.failed = true;
        refresh();
      });
    } else if (!video.paused) {
      video.pause();
    }
    updateButton(button, state);
  }

  function refresh() {
    // Return a previously expanded video to its card before moving in another.
    for (const state of previews.values()) {
      if (state !== active) updatePreview(state);
    }
    if (active) updatePreview(active);
    updateButton(dialogButton, dialog.open ? active : undefined);
  }

  function toggleMotion(state) {
    if (!state) return;
    state.choice = !wantsMotion(state);
    refresh();
  }

  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      const state = previews.get(target);
      state.visible = isIntersecting;
      updatePreview(state);
    }
  });
  for (const card of cards) {
    const project = lookup.get(card.dataset.name);
    if (!project.previewAnimation) continue;
    const preview = card.querySelector('.preview');
    const video = preview.querySelector('video.preview-motion');
    const button = card.querySelector('.preview-motion-toggle');
    if (!video || !button) continue;
    const supportsHd = project.previewAnimationHd && video.canPlayType('video/mp4; codecs="avc1.640028"');
    const source = supportsHd ? project.previewAnimationHd : project.previewAnimation;
    if (!supportsHd && !video.canPlayType('video/mp4; codecs="avc1.42c020"')) continue;
    video.muted = true;
    const state = { card, project, preview, video, button, source, visible: false, choice: null, failed: false, hasFrame: false };
    previews.set(preview, state);
    video.addEventListener('playing', () => {
      if (!video.paused) state.hasFrame = true;
      updatePreview(state);
    });
    video.addEventListener('error', () => {
      state.failed = true;
      refresh();
    });
    button.addEventListener('click', () => toggleMotion(state));
    updatePreview(state);
    observer.observe(preview);
  }

  dialogButton.addEventListener('click', () => toggleMotion(active));
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      for (const state of previews.values()) {
        if (state.choice === true) state.choice = null;
      }
    }
    refresh();
  });
  document.addEventListener('visibilitychange', refresh);
  dialog.addEventListener('close', () => {
    if (!dialog.open) active = undefined;
    refresh();
  });
  return preview => {
    active = previews.get(preview);
    refresh();
  };
}

function update(){
  const q=$('search').value.trim().toLocaleLowerCase(),language=$('language').value;let count=0;cards.forEach(card=>{const p=lookup.get(card.dataset.name),matches=(!q||`${p.title} ${p.description} ${p.name} ${p.category} ${p.languages.join(' ')} ${p.platform}`.toLocaleLowerCase().includes(q))&&matchesCategory(p)&&(language==='all'||p.languages.includes(language));card.hidden=!matches;if(matches)count++;});const sort=$('sort').value;[...cards].sort((a,b)=>sort==='name'?a.dataset.title.localeCompare(b.dataset.title):sort==='language'?a.dataset.languages.localeCompare(b.dataset.languages)||a.dataset.title.localeCompare(b.dataset.title):compareCurated(a,b)).forEach(card=>grid.append(card));$('result-count').innerHTML=`<strong>${count}</strong> ${count===1?'repository':'repositories'}${q||category!=='all'||language!=='all'?' found':' to explore'}`;$('empty-state').hidden=count!==0;$('clear-filters').hidden=!q&&category==='all'&&language==='all';document.querySelectorAll('.filter-chip').forEach(b=>{const active=b.dataset.category===category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});grid.classList.toggle('list',view==='list');$('grid-view').setAttribute('aria-pressed',String(view==='grid'));$('list-view').setAttribute('aria-pressed',String(view==='list'));const next=new URLSearchParams();if(q)next.set('q',$('search').value.trim());if(language!=='all')next.set('language',language);if(category!==defaultCategory||requestedCategory===defaultCategory)next.set('category',category);if(sort!=='featured')next.set('sort',sort);if(view!=='grid')next.set('view',view);history.replaceState(null,'',location.pathname+(next.size?'?'+next:'')+location.hash);}
function reset(){category='all';$('search').value='';$('language').value='all';update();}$('search').addEventListener('input',update);$('language').addEventListener('change',update);$('sort').addEventListener('change',update);document.querySelectorAll('.filter-chip').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;update();}));$('clear-filters').onclick=reset;$('reset-empty').onclick=reset;function setView(v){view=v;try{localStorage.setItem('surfingcoder-view',v);}catch{}update();}$('grid-view').onclick=()=>setView('grid');$('list-view').onclick=()=>setView('list');document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('project-dialog').open){e.preventDefault();$('search').focus();}});
const dialog=$('project-dialog');const selectPreviewMotion=initPreviewAnimations(dialog);let opener;document.querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=>{const p=lookup.get(button.dataset.project);opener=button;$('dialog-title').textContent=p.title;$('dialog-category').textContent=p.category+' · '+p.languages.join(' / ');$('dialog-image').src=p.image;$('dialog-image').alt=p.title+' — '+p.capture.caption;$('dialog-description').textContent=p.description;$('dialog-caption').textContent=(p.capture.kind==='source-preview'?'Source preview — ':p.capture.kind==='terminal'?'Terminal capture — ':'Runtime capture — ')+(p.capture.caption||'Actual interface with demo data.');const play=$('dialog-play');play.hidden=!p.applicationUrl;if(p.applicationUrl)play.href=p.applicationUrl;else play.removeAttribute('href');
const download = $('dialog-download');
download.hidden = !p.downloadUrl;
if (p.downloadUrl) download.href = p.downloadUrl;
else download.removeAttribute('href');
$('dialog-repo').href=p.url;$('dialog-ci').href=p.ci;dialog.showModal();selectPreviewMotion(button);}));$('close-dialog').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>{if(!dialog.open)opener?.focus();});update();})();
