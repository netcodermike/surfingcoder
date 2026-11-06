"""Capture actual demo app UIs and terminal output on an isolated Linux CI runner.

Never reads user credentials. A clearly marked source preview is the fallback,
not an invented application screenshot. Run beneath Xvfb with openbox/scrot.
"""
from __future__ import annotations
import argparse, contextlib, datetime as dt, html, http.server, json, os
from pathlib import Path
import re, shutil, signal, socket, subprocess, sys, tempfile, threading, time
from urllib.parse import urlsplit

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--inventory',default='scripts/projects-inventory.json')
parser.add_argument('--output',default='screenshots')
parser.add_argument('--group',default='all',choices=['all','browser','python','java','kotlin','qt','cli'])
parser.add_argument('--only',nargs='*')
args=parser.parse_args()
OUTPUT=Path(args.output).resolve();OUTPUT.mkdir(parents=True,exist_ok=True)
WORK=Path(tempfile.mkdtemp(prefix='surf-capture-'))
rows=json.loads(Path(args.inventory).read_text(encoding='utf-8'))
if isinstance(rows,dict):rows=rows.get('projects',list(rows.values()))
PROCS=[]

def run(command,cwd=None,timeout=120,check=True,env=None):
    p=subprocess.run(command,cwd=cwd,text=True,encoding='utf-8',errors='replace',stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout,env=env)
    if check and p.returncode:raise RuntimeError(f'{command[0]} exited {p.returncode}: '+p.stdout[-1800:])
    return p.stdout
def start(command,cwd=None,env=None):
    log=open(WORK/(str(len(PROCS))+'.log'),'w',encoding='utf-8')
    p=subprocess.Popen(command,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    PROCS.append((p,log));return p
def cleanup():
    for p,log in reversed(PROCS):
        try:os.killpg(p.pid,signal.SIGTERM)
        except ProcessLookupError:pass
        try:p.wait(timeout=3)
        except subprocess.TimeoutExpired:
            with contextlib.suppress(ProcessLookupError):os.killpg(p.pid,signal.SIGKILL)
        log.close()
    PROCS.clear()
def free_port():
    with socket.socket()as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def ready(url,timeout=60):
    import urllib.request
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        try:
            with urllib.request.urlopen(url,timeout=2)as response:
                if response.status<400:return
        except Exception:time.sleep(.25)
    raise RuntimeError('Server did not become ready: '+url)
def clone(row):
    name=row.get('name')or row.get('repository')or row['slug']
    path=WORK/name
    if not(path/'.git').exists():run(['git','clone','--depth','1',f'https://github.com/netcodermike/{name}.git',str(path)],timeout=50)
    return name,path
def patch(path,old,new):
    text=path.read_text(encoding='utf-8')
    if old not in text:raise RuntimeError('Capture seed insertion not found: '+str(path))
    path.write_text(text.replace(old,new,1),encoding='utf-8')
def record(name,kind,caption,command=None,error=None):
    value={'name':name,'kind':kind,'caption':caption,'capture_date':dt.datetime.now(dt.timezone.utc).isoformat(),'demo_data':True}
    if command:value['command']=command
    if error:value['runtime_error']=str(error)[:900]
    (OUTPUT/(name+'.json')).write_text(json.dumps(value,indent=2),encoding='utf-8')
def normalize(path):
    from PIL import Image
    image=Image.open(path).convert('RGB')
    # Keep the entire genuine app capture; do not crop away warning/status areas.
    image.thumbnail((1600,1100))
    image.save(path)
def native_capture(name,title,command,cwd,env=None):
    start(command,cwd,env)
    end=time.monotonic()+35;window=None
    while time.monotonic()<end:
        listing=run(['wmctrl','-l'],check=False,timeout=3)
        hits=[line for line in listing.splitlines()if title.lower()in line.lower()]
        if hits:window=hits[-1].split()[0];break
        time.sleep(.4)
    if not window:
        logs=[]
        for process,stream in PROCS:
            stream.flush()
            with contextlib.suppress(OSError):logs.append(Path(stream.name).read_text(encoding='utf-8',errors='replace')[-1800:])
        raise RuntimeError('No expected native window: '+title+'\n'+'\n'.join(logs))
    run(['wmctrl','-i','-r',window,'-e','0,30,30,1320,900'],check=False)
    run(['wmctrl','-i','-a',window],check=False);time.sleep(1.2)
    target=OUTPUT/(name+'.png')
    run(['scrot','--focused',str(target)],timeout=10)
    normalize(target);record(name,'runtime','Actual application interface with synthetic demonstration data.',command)

from playwright.sync_api import sync_playwright
PW=sync_playwright().start();BROWSER=PW.chromium.launch(headless=True,args=['--disable-dev-shm-usage'])
def browser_page():
    context=BROWSER.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1,color_scheme='dark')
    # Outbound network is blocked; only the isolated app itself can be reached.
    context.route('**/*',lambda route:route.continue_()if urlsplit(route.request.url).hostname in ('127.0.0.1','localhost',None)else route.abort())
    page=context.new_page();page.set_default_timeout(4500)
    return context,page
def browser_capture(name,url,seed=None,caption=None):
    ready(url);context,page=browser_page()
    try:
        page.goto(url,wait_until='networkidle',timeout=30000)
        if seed:seed(page)
        page.wait_for_timeout(700)
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(OUTPUT/(name+'.png')),full_page=False)
        record(name,'runtime',caption or 'Actual application interface with synthetic demonstration data.')
    finally:context.close()
def static_server(path):
    port=free_port();start([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1'],path);return f'http://127.0.0.1:{port}'
def html_capture(name,title,body,kind='terminal',caption=None):
    context,page=browser_page()
    try:
        page.set_content(f'''<!doctype html><html><meta charset="utf-8"><style>body{{background:#101b2c;margin:0;color:#d9e7f1;font:18px ui-monospace,monospace}}header{{padding:24px 34px;background:#17273d;border-bottom:1px solid #3d5369;display:flex;justify-content:space-between}}small{{color:#93c9b6}}pre{{font-size:17px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;margin:28px 36px}}b{{color:#9fe4c1}}</style><header><b>{html.escape(title)}</b><small>{'SOURCE PREVIEW · NOT A RUNTIME SCREENSHOT'if kind=='source-preview'else'ACTUAL CLI OUTPUT · SYNTHETIC TEST INPUTS'}</small></header><pre>{html.escape(body[:12500])}</pre></html>''')
        page.screenshot(path=str(OUTPUT/(name+'.png')))
        record(name,kind,caption or ('Actual command output from an isolated Linux runner.'if kind=='terminal'else'Actual repository source preview; a runtime screenshot is unavailable.'))
    finally:context.close()

BROWSER_NAMES={'coinbase-ladder','personal-time-machine','multiplayer-escape-room','linux-backup-server','interactive-audio-synthesizer','maze-forge'}
PY_NAMES={'pantry-meal-planner':'planner.py','personal-library-tracker':'library.py','subtitle-sync-studio':'app.py','document-similarity-explorer':'app.py','family-tree-builder':'app.py'}
QT_NAMES={'pixel-sprite-workshop':'Pixel Sprite Workshop','wave-spectrum-lab':'Wave Spectrum Lab','tiny-raytracer-studio':'Tiny Raytracer Studio','fractal-render-lab':'Fractal Render Lab'}
JAVA_TITLES={'spaced-repetition-adventure':'Recall Quest','round-robin-tournament-studio':'Round-Robin Tournament Studio','midi-pattern-studio':'MIDI Pattern Studio','sudoku-studio-desktop':'Sudoku Studio','file-tag-organizer':'File Tag Organizer','chess-tactics-trainer':'Chess Tactics Trainer'}
KOTLIN_TITLES={'fairshare-expense-splitter':'FairShare','habit-garden-desktop':'Habit Garden','packing-list-companion':'Packing List','weekly-timetable-planner':'Weekly Timetable Planner','interval-workout-composer':'Interval Workout Composer'}

def group(row):
    name=row.get('name')or row.get('repository')or row.get('slug');language=row.get('language')
    if name=='offline-field-journal':return None  # Android is captured by its own emulator job.
    if name in BROWSER_NAMES or language=='TypeScript':return 'browser'
    if name in PY_NAMES:return 'python'
    if name in QT_NAMES:return 'qt'
    if language=='Java':return 'java'
    if language=='Kotlin':return 'kotlin'
    if language in ('Rust','Go','C'):return 'cli'
    return None

def browser_app(name,path):
    if name=='coinbase-ladder':
        run([sys.executable,'-m','pip','install','-q','-r','requirements.txt'],path,timeout=120)
        # The legacy form hardcodes public rules; select the app's existing demo
        # calculation mode in this ephemeral screenshot checkout only.
        static_js=path/'static/app.js'
        static_js.write_text(static_js.read_text(encoding='utf-8').replace("mode: 'public'","mode: 'demo'"),encoding='utf-8')
        # Importing rather than app.py __main__ prevents the conditional monitor starting.
        (path/'gallery_server.py').write_text('''import app,connection\nfrom flask import request,abort\nconnection.load_credentials=lambda:None\napp.get_catalog=lambda:{"assets":[{"symbol":"BTC","name":"Bitcoin","rank":1,"favorite":True,"pairs":{"USD":{"product":"BTC-USD","available":True},"USDC":{"product":"BTC-USDC","available":True}}},{"symbol":"ETH","name":"Ethereum","rank":2,"favorite":True,"pairs":{"USD":{"product":"ETH-USD","available":True}}}],"as_of":"2026-11-06T12:00:00Z","ranking":"Synthetic demo catalog"}\n@app.app.before_request\ndef gallery_guard():\n if request.method=='POST' and request.path not in ['/api/calculate','/api/connection/status']:abort(403)\napp.app.run(host="127.0.0.1",port=8765,use_reloader=False)\n''',encoding='utf-8')
        start([sys.executable,'gallery_server.py'],path)
        def seed(page):
            page.add_init_script("window.WebSocket=class{constructor(){this.readyState=3;}addEventListener(){}send(){}close(){}};")
            # Retain explicit disconnected status; never create account credentials.
            mode=page.locator('#mode')
            if mode.count():mode.select_option('demo')
            for selector,value in [('#budget','2500'),('#ladder','price,percent\n64000,20\n62000,25\n60000,30\n58000,25')]:
                if page.locator(selector).count():page.locator(selector).fill(value)
            if page.locator('#calculate').count():page.locator('#calculate').click();page.wait_for_timeout(800)
        # Block every WebSocket before page load, including the public price feed.
        ready('http://127.0.0.1:8765');context,page=browser_page()
        try:
            page.add_init_script("window.WebSocket=class{constructor(){this.readyState=3;}addEventListener(){}send(){}close(){}};")
            page.goto('http://127.0.0.1:8765',wait_until='networkidle');seed(page);page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(OUTPUT/(name+'.png')))
            record(name,'runtime','Actual Crypto Ladder interface using its local demo calculator; disconnected from every account and exchange.')
        finally:context.close()
        return
    if name=='personal-time-machine':
        demo=path/'demo-folder';demo.mkdir();(demo/'notes.md').write_text('# Project notes\nInitial design.\n')
        run([sys.executable,'timemachine.py',str(demo),'snapshot','--label','Initial design'],path)
        (demo/'notes.md').write_text('# Project notes\nRefined design and delivery checklist.\n')
        run([sys.executable,'timemachine.py',str(demo),'snapshot','--label','Before refactor'],path)
        start([sys.executable,'timemachine.py',str(demo),'serve','--port','8080'],path);browser_capture(name,'http://127.0.0.1:8080');return
    if name=='linux-backup-server':
        run(['go','build','-o','vault','.'],path,timeout=120);env=dict(os.environ,BACKUP_TOKEN='gallery-demo-token-not-a-real-secret',BACKUP_KEY='12'*32,BACKUP_DIR=str(path/'demo-vault'))
        start([str(path/'vault'),'serve'],path,env);browser_capture(name,'http://127.0.0.1:8088',lambda page:(page.locator('#token').fill(env['BACKUP_TOKEN']),page.locator('#key').fill(env['BACKUP_KEY'])))
        return
    if name=='interactive-audio-synthesizer':
        url=static_server(path);browser_capture(name,url+'/playground.html');return
    if name=='maze-forge':
        run(['cmake','-S','.','-B','build'],path);run(['cmake','--build','build','-j','2'],path);run([str(path/'build/maze'),'--width','20','--height','13','--seed','42','--output','maze.html'],path)
        browser_capture(name,static_server(path)+'/maze.html');return
    port=free_port();start(['node','server.ts'],path,dict(os.environ,PORT=str(port)))
    def seed(page):
        if name=='multiplayer-escape-room':
            page.locator('#create').click();page.wait_for_timeout(600)
        elif name=='pathfinding-playground':
            page.locator('#brush').select_option('0')
            box=page.locator('#grid').bounding_box()
            if box:
                x=box['x']+box['width']*.52;top=box['y']+box['height']*.08;bottom=min(920,box['y']+box['height']*.7)
                page.mouse.move(x,top);page.mouse.down();page.mouse.move(x,bottom,steps=18);page.mouse.up()
        elif name=='local-whiteboard-studio':
            page.mouse.move(280,420);page.mouse.down();page.mouse.move(500,470,steps=15);page.mouse.move(650,400,steps=15);page.mouse.up()
            page.locator('#tool').select_option('rect');page.mouse.move(620,450);page.mouse.down();page.mouse.move(880,650,steps=10);page.mouse.up()
        elif name=='offline-stockroom-tracker':
            for sku,label,qty,minimum in [('1001','Stainless bolts',72,24),('1002','Cable ties',18,30),('1003','Packing labels',240,100)]:
                for selector,value in [('#sku',sku),('#name',label),('#qty',str(qty)),('#min',str(minimum))]:page.locator(selector).fill(value)
                page.locator('#add').click()
        elif name=='tabletop-map-workshop':
            page.locator('#brush').select_option('2');page.mouse.move(170,400);page.mouse.down();page.mouse.move(450,500,steps=20);page.mouse.up()
    browser_capture(name,f'http://127.0.0.1:{port}',seed)

def python_app(name,path):
    now=dt.date.today()
    if name=='pantry-meal-planner':
        (path/'pantry.json').write_text(json.dumps({'pantry':['pasta','tomato','olive oil','rice','beans','egg'],'recipes':[{'name':'Tomato pasta','ingredients':['pasta','tomato','olive oil']},{'name':'Bean rice bowl','ingredients':['rice','beans','onion']},{'name':'Garden omelette','ingredients':['egg','spinach','cheese']},{'name':'Apple oats','ingredients':['oats','apple','milk']}]}))
    elif name=='personal-library-tracker':
        run([sys.executable,'-c',"from library import Library; l=Library(); a=l.add('Designing Data-Intensive Applications','Martin Kleppmann'); l.status(a,'reading'); b=l.add('The Pragmatic Programmer','Andrew Hunt and David Thomas'); l.status(b,'finished'); c=l.add('Clean Architecture','Robert C. Martin'); l.lend(c,'Demo borrower','2030-01-20'); l.close()"],path)
    elif name=='subtitle-sync-studio':
        fixture=path/'demo.srt';fixture.write_text('1\n00:00:01,200 --> 00:00:03,800\nA small adjustment changes the story.\n\n2\n00:00:04,100 --> 00:00:07,000\nKeep every cue in sync with the moment.\n\n3\n00:00:08,000 --> 00:00:10,600\nPreview, compare, and export.\n')
        patch(path/'app.py','root.mainloop()',f"filedialog.askopenfilename=lambda **kwargs:{str(fixture)!r};root.after(300,load);root.mainloop()")
    elif name=='document-similarity-explorer':
        folder=path/'demo-docs';folder.mkdir()
        for name_,text in [('design-notes.md','software architecture data pipelines testing modular software design'),('implementation.md','software design architecture testing data pipelines'),('research.txt','ocean wave swell tide coast surfing weather'),('field-notes.txt','ocean waves coast surfing tide weather')]:(folder/name_).write_text(text)
        patch(path/'app.py','r.mainloop()',f"filedialog.askdirectory=lambda:{str(folder)!r};r.after(300,openfolder);r.mainloop()")
    elif name=='family-tree-builder':
        data={'version':1,'people':{'a':{'name':'Alex Morgan','year':1950},'b':{'name':'Sam Morgan','year':1953},'c':{'name':'Taylor Morgan','year':1980},'d':{'name':'Robin Morgan','year':2007}},'edges':[['a','c'],['b','c'],['c','d']]}
        patch(path/'app.py',"data={'version':1,'people':{},'edges':[]}",'data='+repr(data))
    title={'pantry-meal-planner':'Pantry Meal Planner','personal-library-tracker':'Personal Library','subtitle-sync-studio':'Subtitle Sync Studio','document-similarity-explorer':'Document Similarity Explorer','family-tree-builder':'Family Tree Builder'}[name]
    native_capture(name,title,['/usr/bin/python3',PY_NAMES[name]],path)

def java_app(name,path):
    src=next((path/'src').glob('*.java'));classname=src.stem
    if name=='spaced-repetition-adventure':
        (path/'deck.tsv').write_text('What is the time complexity of binary search?\tO(log n)\nWhich data structure follows FIFO?\tQueue\nWhat is a pure function?\tA function determined only by its inputs\n',encoding='utf-8')
    elif name=='round-robin-tournament-studio':
        (path/'tournament.properties').write_text('teams=4\nteam.0=Falcons\nteam.1=Otters\nteam.2=Foxes\nteam.3=Owls\nscore.0=2,1\nscore.1=1,1\nscore.2=0,3\n',encoding='utf-8')
    elif name=='midi-pattern-studio':
        patch(src,'root.add(grid,BorderLayout.CENTER);','for(int column=0;column<16;column++){cells[2][column].setSelected(column%2==0);cells[0][column].setSelected(column==0||column==8);cells[1][column].setSelected(column==4||column==12);}root.add(grid,BorderLayout.CENTER);')
    if name=='file-tag-organizer':
        fixture=path/'demo-report.txt';fixture.write_text('Synthetic project report')
        patch(src,'Map<String,Set<String>>data=new TreeMap<>();',f'Map<String,Set<String>>data=new TreeMap<>();data.put({json.dumps(str(fixture))},tags("work, reports"));data.put("/demo/architecture.md",tags("work, design"));')
    run(['javac','-d','build',str(src.relative_to(path))],path,timeout=60)
    native_capture(name,JAVA_TITLES[name],['java','-cp','build',classname],path)

def kotlin_app(name,path):
    source=path/'src/main/kotlin/Main.kt'
    if name=='fairshare-expense-splitter':
        (path/'ledger.properties').write_text('people.count=3\nperson.0=Ada\nperson.1=Ben\nperson.2=Cy\nexpenses.count=3\nexpense.0.payer=Ada\nexpense.0.cents=8400\nexpense.0.note=Dinner\nexpense.1.payer=Ben\nexpense.1.cents=3600\nexpense.1.note=Train tickets\nexpense.2.payer=Cy\nexpense.2.cents=2250\nexpense.2.note=Groceries\n')
    elif name=='habit-garden-desktop':
        lines=['count=4']
        for i,(title,count)in enumerate([('Read',14),('Walk',8),('Build',20),('Journal',5)]):
            days=','.join((dt.date.today()-dt.timedelta(days=j)).isoformat()for j in range(count));lines+= [f'habit.{i}.name={title}',f'habit.{i}.days={days}']
        (path/'garden.properties').write_text('\n'.join(lines))
    elif name=='packing-list-companion':
        patch(source,'var items=mutableListOf<Item>()','var items=mutableListOf(Item("Clothing","Base layers",3,true),Item("Gear","Notebook",1,false),Item("Clothing","Walking shoes",1,true),Item("Essentials","Water bottle",1,false))')
    elif name=='weekly-timetable-planner':
        patch(source,'var events=mutableListOf<Event>()','var events=mutableListOf(Event(0,540,600,"Deep work"),Event(0,630,660,"Project review"),Event(1,600,690,"Design session"),Event(2,780,840,"Learning hour"))')
    elif name=='interval-workout-composer':
        patch(source,'timer.start();','running=true;started=System.nanoTime();timer.start();')
    run(['gradle','installDist','--no-daemon'],path,timeout=240)
    scripts=[p for p in (path/'build/install').glob('*/bin/*')if p.is_file()and p.suffix!='.bat']
    if not scripts:raise RuntimeError('No Gradle application launcher')
    native_capture(name,KOTLIN_TITLES[name],[str(scripts[0])],path)

def qt_app(name,path):
    source=path/'main.cpp'
    if name=='pixel-sprite-workshop':
        seed='for(int y=3;y<13;y++)for(int x=4;x<12;x++)canvas->frames[0].setPixelColor(x,y,QColor((x+y)%3==0?"#f8c55b":"#36a9a1"));canvas->frames.append(canvas->frames[0].copy());canvas->frames[1].setPixelColor(5,5,QColor("#18283b"));'
        patch(source,'window.show();',seed+'window.show();')
    elif name in ('tiny-raytracer-studio','fractal-render-lab'):
        value='2'if name=='tiny-raytracer-studio'else'-0.5,0,1'
        patch(source,'w.show();',f'input->setText("{value}");render->click();w.show();')
    elif name=='wave-spectrum-lab':
        import wave,math,struct
        wav=path/'demo.wav'
        with wave.open(str(wav),'wb')as f:
            f.setnchannels(1);f.setsampwidth(2);f.setframerate(44100);f.writeframes(b''.join(struct.pack('<h',int((math.sin(i*2*math.pi*440/44100)+.4*math.sin(i*2*math.pi*880/44100))*16000))for i in range(44100)))
        patch(source,'w.show();',f'input->setText({json.dumps(str(wav))});render->click();w.show();')
    run(['cmake','-S','.','-B','build','-DCMAKE_BUILD_TYPE=Release'],path,timeout=60);run(['cmake','--build','build','-j','2'],path,timeout=120)
    executable='sprite'if name=='pixel-sprite-workshop'else'app'
    native_capture(name,QT_NAMES[name],[str(path/'build'/executable)],path,dict(os.environ,QT_QPA_PLATFORM='xcb'))

def cli_app(name,path):
    language=next((r.get('language')for r in rows if (r.get('name')or r.get('repository')or r.get('slug'))==name),None)
    demo=path/'capture-demo';demo.mkdir(exist_ok=True);(demo/'service.conf').write_text('mode=development\nworkers=4\n')
    title='$ '+name;command=[]
    if language=='Rust':
        run(['cargo','build','--release'],path,timeout=120)
        binary=path/'target/release'/name
        extra={'linux-system-dashboard':['--once'],'linux-process-explorer':['--memory'],'linux-open-port-atlas':[],'linux-disk-space-sentinel':['--path','/','--threshold','90'],'linux-package-footprint':['python'],'linux-mount-explorer':['/proc']}.get(name,[])
        command=[str(binary),*extra];output=run(command,path,timeout=15,check=False)
    elif language=='Go':
        run(['go','build','-o','capture-app','.'],path,timeout=120);binary=str(path/'capture-app')
        if name=='linux-systemd-unit-checker':command=[binary,'examples/worker.service'];output=run(command,path,check=False)
        elif name=='linux-cgroup-explorer':command=[binary,'--depth','1'];output=run(command,path,timeout=15,check=False)
        elif name=='linux-config-drift-monitor':
            manifest=path/'demo-baseline.json';run([binary,'baseline',str(demo),str(manifest)],path);(demo/'service.conf').write_text('mode=production\nworkers=8\n');(demo/'new.conf').write_text('enabled=yes\n');command=[binary,'check',str(demo),str(manifest)];output=run(command,path,check=False)
        elif name=='linux-job-scheduler':command=[binary,'examples/jobs.json'];output=run(command,path,timeout=10,check=False)
        elif name=='linux-journal-explorer':command=['go','test','-v','./...'];output=run(command,path,timeout=40);title+=' · parser verification'
        else:command=['go','test','-v','./...'];output=run(command,path,timeout=40)
    elif language=='C':
        run(['make'],path,timeout=60)
        if name=='linux-sandbox-runner':command=[str(path/'sandbox')];output=run(command,path,check=False)
        elif name=='linux-mmap-search':
            (demo/'notes.txt').write_text('connection established\nworker started\nconnection verified\nservice ready\n');command=[str(path/'app'),'connection',str(demo/'notes.txt')];output=run(command,path)
        elif name=='linux-resource-job-queue':
            jobs=demo/'jobs.tsv';jobs.write_text('/usr/bin/printf\tBuild complete\\n\n/usr/bin/true\n');command=[str(path/'app'),'2',str(jobs)];output=run(command,path,timeout=10)
        elif name=='linux-directory-watch':
            p=start([str(path/'dirwatch'),str(demo)],path);time.sleep(.3);(demo/'report.txt').write_text('Demo report');(demo/'report.txt').rename(demo/'reviewed.txt');time.sleep(.3);os.killpg(p.pid,signal.SIGTERM);p.wait(timeout=4);output=PROCS[-1][1].name;output=Path(output).read_text();command=['./dirwatch','./capture-demo']
        else:command=['make','test'];output=run(command,path,timeout=40);title+=' · integration test'
    else:raise RuntimeError('Unsupported terminal language: '+str(language))
    output=re.sub(r'\x1b\[[0-9;]*[A-Za-z]','',output)
    display=' '.join(Path(v).name if i==0 else v.replace(str(path),'./')for i,v in enumerate(command))
    html_capture(name,title,'$ '+display+'\n\n'+output[:10000])

if args.group in ('all','python','java','kotlin','qt'):
    if not os.environ.get('DISPLAY'):raise SystemExit('Native captures require DISPLAY (use xvfb-run)')
    start(['openbox','--sm-disable']);time.sleep(.4)
selected=[r for r in rows if group(r)and(args.group=='all'or group(r)==args.group)and(not args.only or(r.get('name')or r.get('repository')or r.get('slug'))in args.only)]
for row in selected:
    name=row.get('name')or row.get('repository')or row.get('slug');path=None
    print('CAPTURE',name,group(row),flush=True)
    try:
        name,path=clone(row)
        {'browser':browser_app,'python':python_app,'java':java_app,'kotlin':kotlin_app,'qt':qt_app,'cli':cli_app}[group(row)](name,path)
        print('OK',name,flush=True)
    except Exception as error:
        print('FALLBACK',name,str(error)[:400],flush=True)
        try:
            if path:
                candidates=[p for p in path.rglob('*')if p.is_file()and p.suffix in('.py','.ts','.rs','.go','.java','.kt','.cpp','.c')and'.git'not in p.parts and'build'not in p.parts and'node_modules'not in p.parts]
                preferred=next((p for p in candidates if p.name in('main.rs','main.go','main.cpp','Main.kt','App.java','app.py','core.ts')),candidates[0]if candidates else path/'README.md')
                text=preferred.read_text(encoding='utf-8',errors='replace').splitlines()
                html_capture(name,name+' · source preview',preferred.relative_to(path).as_posix()+'\n\n'+'\n'.join(f'{i+1:>3}  {line}'for i,line in enumerate(text[:45])),'source-preview')
                value=json.loads((OUTPUT/(name+'.json')).read_text());value['runtime_error']=str(error)[:900];(OUTPUT/(name+'.json')).write_text(json.dumps(value,indent=2))
        except Exception as nested:print('CAPTURE_FAILED',name,str(nested)[:400],flush=True)
    finally:
        cleanup()
        if args.group in('all','python','java','kotlin','qt'):
            # openbox was owned by cleanup too; restart it for the next native window.
            start(['openbox','--sm-disable']);time.sleep(.2)
cleanup();BROWSER.close();PW.stop()
print('Captured',len(list(OUTPUT.glob('*.png'))),'images',flush=True)
