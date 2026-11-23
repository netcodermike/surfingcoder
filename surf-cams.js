(() => {
  const menu = document.querySelector('.sc-site-header .sc-surf-cams');
  const list = menu?.querySelector('.sc-surf-cams-links');
  if (!list) return;

  const cameras = Array.from(list.querySelectorAll('li > a'), (link, index) => ({
    item: link.parentElement,
    key: 'surfingcoder:surf-cam-visits:' + link.getAttribute('href'),
    index,
    visits: 0,
  }));

  function visitCount(camera) {
    try {
      const count = Number(localStorage.getItem(camera.key));
      return Number.isSafeInteger(count) && count > 0 ? count : 0;
    } catch {
      return camera.visits;
    }
  }

  function rankCameras() {
    const ordered = cameras.map(camera => ({ ...camera, visits: visitCount(camera) }))
      .sort((a, b) => b.visits - a.visits || a.index - b.index);
    if (ordered.some(({ item }, index) => item !== list.children[index])) {
      list.append(...ordered.map(({ item }) => item));
    }
  }

  for (const camera of cameras) {
    const link = camera.item.firstElementChild;
    function recordVisit(event) {
      if (event.defaultPrevented || event.button > 1) return;
      camera.visits = Math.min(visitCount(camera) + 1, Number.MAX_SAFE_INTEGER);
      try {
        localStorage.setItem(camera.key, String(camera.visits));
      } catch {
        // The camera link still works when browser storage is disabled.
      }
    }
    link.addEventListener('click', recordVisit);
    link.addEventListener('auxclick', recordVisit);
  }

  // Refresh on open so other tabs can contribute without moving a link under the pointer.
  menu.addEventListener('toggle', () => {
    if (menu.open) rankCameras();
  });
  rankCameras();
})();
