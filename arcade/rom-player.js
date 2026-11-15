const notice = document.getElementById('notice')
let initiated = false
const data = 'https://cdn.emulatorjs.org/4.2.3/data/'
const host = new URL(document.baseURI).origin
window.addEventListener('message',event => {
  if (initiated || event.origin !== host || event.source !== parent) return
  const {type,file} = event.data ?? {}
  if (type !== 'play-local-rom' || !(file instanceof File)) return
  initiated = true
  Object.assign(window,{
    EJS_player:'#game',
    EJS_core:'mame2003_plus',
    EJS_gameUrl:file,
    EJS_gameName:file.name.replace(/\.zip$/i,''),
    EJS_pathtodata:data,
    EJS_threads:false,
    EJS_startOnLoaded:false,
    EJS_disableDatabases:true,
    EJS_onGameStart:() => { notice.textContent = 'Emulator running. Use its controls menu to remap keys.' },
  })
  const script = document.createElement('script')
  script.src = data+'loader.js'
  script.referrerPolicy = 'no-referrer'
  script.onload = () => {notice.textContent = 'Select Start Game. If the ZIP fails to boot, check that it matches MAME 2003-Plus.'}
  script.onerror = () => {notice.textContent = 'The emulator could not load. Close this window and try again.'}
  document.head.append(script)
})
