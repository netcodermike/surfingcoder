(() => {
  const storageKey = 'surfingcoder.theme';
  const themes = ['dark', 'light', 'dusk'];
  const root = document.documentElement;
  let storage;
  let savedTheme;
  try {
    storage = window.localStorage;
    savedTheme = storage.getItem(storageKey);
  } catch {
    // A visitor can still switch themes when local storage is unavailable.
  }
  root.dataset.theme = themes.includes(savedTheme) ? savedTheme : 'dark';

  document.addEventListener('DOMContentLoaded', () => {
    const picker = document.querySelector('#sc-theme-picker');
    const themeColor = document.querySelector('meta[name="theme-color"]');

    function applyTheme(theme) {
      root.dataset.theme = themes.includes(theme) ? theme : 'dark';
      picker.value = root.dataset.theme;
      if (themeColor) {
        themeColor.content = getComputedStyle(root).getPropertyValue('--sc-page').trim();
      }
    }

    applyTheme(root.dataset.theme);
    picker.closest('.sc-theme-control').hidden = false;
    picker.addEventListener('change', () => {
      applyTheme(picker.value);
      try {
        storage?.setItem(storageKey, picker.value);
      } catch {
        // The selected theme remains active for this page.
      }
    });
    window.addEventListener('storage', event => {
      if (event.storageArea === storage && (event.key === storageKey || event.key === null)) {
        applyTheme(event.newValue);
      }
    });
  }, {once: true});
})();
