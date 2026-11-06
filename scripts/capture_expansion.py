"""Capture actual new-app interfaces or actual CLI output in disposable CI runners.

Only synthetic fixtures are supplied. Build/test/demo failures fail the job and
produce a diagnostics report, never a fabricated replacement screenshot.
"""
from __future__ import annotations
import argparse, contextlib, datetime as dt, html, http.server, json, math, os
from pathlib import Path
import re, shutil, socket, struct, subprocess, tempfile, threading, time, wave

GROUPS={'Rust':'rust','Java':'jvm','Kotlin':'jvm','Swift':'swift'}
def group(row):
    if row.get('kind') in ('web','server'): return 'web'
    return GROUPS.get(row.get('language'),'native')

def selected(inventory,batch,capture_group):
    rows=json.loads(Path(inventory).read_text(encoding='utf-8'))
    if isinstance(rows,dict): rows=rows.get('projects',list(rows.values()))
    return [r for r in rows if (not batch or int(r.get('batch',0))==batch) and (capture_group=='all' or group(r)==capture_group)]

def command(text,cwd,timeout=300):
    result=subprocess.run(text,cwd=cwd,shell=True,executable='/bin/bash',text=True,encoding='utf-8',errors='replace',stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout,env=dict(os.environ,CI='true',NO_COLOR='1',PYTHONUNBUFFERED='1',DOTNET_CLI_TELEMETRY_OPTOUT='1'))
    if result.returncode: raise RuntimeError(f'Command failed ({result.returncode}): {text}\n'+result.stdout[-12000:])
    return result.stdout

def free_port():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]

def fixture(path):
    rate=24000
    with wave.open(str(path),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate)
        f.writeframes(b''.join(struct.pack('<h',int(11000*math.sin(2*math.pi*440*i/rate))) for i in range(rate*8)))

def terminal_capture(path,title,cmd,output):
    from PIL import Image,ImageDraw,ImageFont
    import textwrap
    fonts=['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','/System/Library/Fonts/Menlo.ttc','/System/Library/Fonts/Supplemental/Courier New.ttf']
    fpath=next((p for p in fonts if Path(p).exists()),None)
    font=ImageFont.truetype(fpath,18) if fpath else ImageFont.load_default(size=18)
    heading=ImageFont.truetype(fpath,23) if fpath else ImageFont.load_default(size=23)
    output=re.sub(r'\x1b\[[0-9;]*[A-Za-z]','',output)
    lines=[]
    for line in ('$ '+cmd+'\n\n'+output).expandtabs(4).splitlines():lines.extend(textwrap.wrap(line,width=104,replace_whitespace=False,drop_whitespace=False) or [''])
    limited=len(lines)>42;lines=lines[:42]
    if limited:lines[-1]='[Output excerpt; full validation output is in the capture log.]'
    image=Image.new('RGB',(1440,1160),'#101d29');d=ImageDraw.Draw(image)
    d.rectangle((0,0,1440,108),fill='#1b3343');d.text((35,24),title,font=heading,fill='#b4ead3')
    d.text((35,66),'ACTUAL COMMAND OUTPUT  |  SYNTHETIC INPUTS  |  DOMAIN CHECKS PASSED',font=font,fill='#91b4c3')
    for i,line in enumerate(lines):d.text((35,130+i*23),line,font=font,fill='#e6f0f5')
    image.save(path)
    return limited

@contextlib.contextmanager
def static_server(directory):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self,*a,**kw):super().__init__(*a,directory=str(directory),**kw)
        def log_message(self,*args):pass
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:yield 'http://127.0.0.1:'+str(server.server_port)
    finally:server.shutdown();server.server_close()

@contextlib.contextmanager
def app_server(row,directory):
    start=row.get('server_command') or row.get('run')
    if not start:raise RuntimeError('Server app needs server_command or run metadata')
    url=row.get('server_url','http://127.0.0.1:8080')
    with tempfile.TemporaryFile(mode='w+',encoding='utf-8') as log:
        proc=subprocess.Popen(start,cwd=directory,shell=True,executable='/bin/bash',stdout=log,stderr=subprocess.STDOUT,start_new_session=True,env=dict(os.environ,HOST='127.0.0.1',PORT='8080',PYTHONUNBUFFERED='1'))
        try:
            import urllib.request
            until=time.monotonic()+35
            while time.monotonic()<until:
                try:
                    with urllib.request.urlopen(url,timeout=2) as response:
                        if response.status==200:break
                except Exception:
                    if proc.poll() is not None:break
                    time.sleep(.25)
            else:raise RuntimeError('Server did not become ready')
            if proc.poll() is not None:
                log.seek(0);raise RuntimeError('Server exited: '+log.read()[-5000:])
            yield url
        finally:
            import signal
            with contextlib.suppress(ProcessLookupError):os.killpg(proc.pid,signal.SIGTERM)
            with contextlib.suppress(subprocess.TimeoutExpired):proc.wait(timeout=5)
            if proc.poll() is None:
                with contextlib.suppress(ProcessLookupError):os.killpg(proc.pid,signal.SIGKILL)

def browser_capture(row,directory,target,browser):
    context=browser.new_context(viewport={'width':1440,'height':1050},device_scale_factor=1,permissions=['microphone'],color_scheme='dark')
    page=context.new_page();page.set_default_timeout(10000);errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    # This CI-only fake audio device supplies a generated sine-wave fixture; no
    # user's microphone or private recording is ever reached.
    with (app_server(row,directory) if row.get('kind')=='server' else static_server(directory)) as url:
        page.goto(url,wait_until='domcontentloaded',timeout=45000)
        page.locator(row.get('screenshot_ready','h1')).first.wait_for(state='visible')
        name=row['name']
        if name=='string-instrument-tuner':page.locator('#start').click();page.wait_for_timeout(1800)
        elif name in ('surfcoder-boombox','audio-ab-loop-studio','spectrogram-waterfall'):
            fixture_path=directory/'capture-tone.wav';fixture(fixture_path)
            selector='#files' if name=='surfcoder-boombox' else '#file'
            page.locator(selector).set_input_files(str(fixture_path))
            page.wait_for_timeout(450)
            if name=='surfcoder-boombox':page.locator('#play').click()
            elif name=='audio-ab-loop-studio':page.locator('#loop').click()
            page.wait_for_timeout(850)
        elif name in ('ambient-soundscape-mixer','pocket-drum-foundry'):
            page.locator('#start' if name=='ambient-soundscape-mixer' else '#play').click();page.wait_for_timeout(650)
        for action in row.get('capture_actions',[]):
            locator=page.locator(action['selector'])
            if action['action']=='click':locator.click()
            elif action['action']=='fill':locator.fill(str(action['value']))
            elif action['action']=='select':locator.select_option(str(action['value']))
            else:raise RuntimeError('Unsupported capture action')
        if row.get('capture_wait_ms'):page.wait_for_timeout(min(10000,int(row['capture_wait_ms'])))
        page.wait_for_timeout(450)
        if errors:raise RuntimeError('Browser page errors: '+'; '.join(errors))
        if not page.locator('h1').inner_text().strip():raise RuntimeError('Empty application heading')
        page.screenshot(path=str(target),full_page=False)
        status=page.locator('#status').inner_text() if page.locator('#status').count() else ''
    context.close()
    return status

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory',default='scripts/expansion40-inventory.json')
    parser.add_argument('--output',default='screenshots-expansion40')
    parser.add_argument('--group',choices=['all','web','native','rust','jvm','swift'],default='all')
    parser.add_argument('--batch',type=int,default=0)
    args=parser.parse_args();rows=selected(args.inventory,args.batch,args.group)
    out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
    results=[]
    browser=pw=None
    with tempfile.TemporaryDirectory(prefix='surf-expansion40-') as temp:
        root=Path(temp)
        if any(row.get('kind') in ('web','server') for row in rows):
            from playwright.sync_api import sync_playwright
            audio_path=root/'synthetic-input.wav';fixture(audio_path)
            pw=sync_playwright().start();browser=pw.chromium.launch(headless=True,args=['--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+str(audio_path)])
        try:
            for row in rows:
                name=row['name'];report={'name':name,'capture_date':dt.datetime.now(dt.timezone.utc).isoformat(),'demo_data':True,'validation_passed':False}
                print('CAPTURE',name,flush=True)
                try:
                    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*',name):raise RuntimeError('Invalid repository slug')
                    path=root/name
                    command('git clone --depth 1 https://github.com/netcodermike/'+name+'.git '+name,root,90)
                    report['source_commit']=command('git rev-parse HEAD',path,10).strip()
                    log=[]
                    for cmd in row.get('commands',[]):
                        text=command(cmd,path,420);log.append('$ '+cmd+'\n'+text)
                    report['validation_passed']=True;report['validation_commands']=row.get('commands',[])
                    (out/(name+'.validation.log')).write_text('\n'.join(log),encoding='utf-8')
                    target=out/(name+'.png')
                    if row.get('kind') in ('web','server'):
                        status=browser_capture(row,path,target,browser)
                        report.update(kind='runtime',caption='Actual application interface with synthetic demonstration inputs; microphone apps use a generated test tone.',capture_method='Playwright Chromium on disposable CI runner')
                        if status:report['visible_status']=status
                    else:
                        demo=row.get('demo') or row.get('capture_command')
                        if not demo:raise RuntimeError('CLI app requires demo or capture_command metadata')
                        text=command(demo,path,120)
                        if not text.strip():raise RuntimeError('Demo returned no visible output')
                        excerpt=terminal_capture(target,row.get('title',name),demo,text)
                        report.update(kind='terminal',caption='Actual command output from an isolated runner using synthetic inputs'+('; excerpt.' if excerpt else '.'),command=demo)
                        (out/(name+'.demo.log')).write_text(text,encoding='utf-8')
                    (out/(name+'.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
                    report['ok']=True;print('CAPTURED',name,flush=True)
                except Exception as error:
                    report.update(ok=False,error=str(error)[-15000:]);(out/(name+'.error.json')).write_text(json.dumps(report,indent=2),encoding='utf-8');print('FAILED',name,str(error)[-2500:],flush=True)
                results.append(report)
        finally:
            if browser:browser.close()
            if pw:pw.stop()
    (out/('results-'+args.group+'.json')).write_text(json.dumps(results,indent=2),encoding='utf-8')
    print('Capture summary:',sum(r.get('ok',False) for r in results),'/',len(rows),flush=True)
    if any(not r.get('ok') for r in results):raise SystemExit(1)
if __name__=='__main__':main()
