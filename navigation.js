document.addEventListener('click', event => {
  const path = event.composedPath();
  for (const menu of document.querySelectorAll('details[open]')) {
    if (!path.includes(menu)) menu.open = false;
  }
}, { capture: true });
