export const browser = {
  save(name, bytes) {
    const types = {
      png: 'image/png', svg: 'image/svg+xml', json: 'application/json',
      css: 'text/css', txt: 'text/plain',
    };
    const mime = types[name.split('.').at(-1)] ?? 'application/octet-stream';
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  },
  async copyColor(color) {
    await navigator.clipboard.writeText(color);
  }
};
