"""Genuine WPF render captures in isolated CI clones, using synthetic fixtures only."""
import argparse,json,os,subprocess,time
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--inventory',required=True);p.add_argument('--output',default='screenshots');p.add_argument('--only',nargs='*');args=p.parse_args()
out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True);root=Path('capture-work-windows').resolve();root.mkdir(exist_ok=True)
items=json.loads(Path(args.inventory).read_text(encoding='utf-8'))
helper=r'''
using System;using System.IO;using System.Runtime.CompilerServices;using System.Windows;using System.Windows.Media;using System.Windows.Media.Imaging;using System.Windows.Threading;
internal static class GalleryCapture{
 static bool done;
 [ModuleInitializer]internal static void Init(){if(Environment.GetEnvironmentVariable("SC_SCREENSHOT")!=null)EventManager.RegisterClassHandler(typeof(Window),FrameworkElement.LoadedEvent,new RoutedEventHandler(Loaded));}
 static void Loaded(object sender,RoutedEventArgs e){if(done||sender is not Window w)return;done=true;w.Width=1440;w.Height=950;var timer=new DispatcherTimer{Interval=TimeSpan.FromSeconds(3)};timer.Tick+=(_,_)=>{timer.Stop();try{w.UpdateLayout();var view=w.Content as FrameworkElement;if(view==null)throw new Exception("No content");int width=Math.Max(1,(int)Math.Ceiling(view.ActualWidth)),height=Math.Max(1,(int)Math.Ceiling(view.ActualHeight));var bitmap=new RenderTargetBitmap(width,height,96,96,PixelFormats.Pbgra32);bitmap.Render(view);var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(bitmap));using(var f=File.Create(Environment.GetEnvironmentVariable("SC_SCREENSHOT")!))encoder.Save(f);}finally{Application.Current.Shutdown();}};timer.Start();}
}
'''
def run(command,cwd,timeout=240):
 r=subprocess.run(command,cwd=cwd,text=True,encoding='utf-8',errors='replace',capture_output=True,timeout=timeout)
 if r.returncode:raise RuntimeError(r.stdout[-2000:]+r.stderr[-2000:])
 return r
for item in items:
 if item.get('language')!='C#':continue
 name=item['name']
 if args.only and name not in args.only:continue
 folder=root/name;png=out/(name+'.png')
 try:
  if not(folder/'.git').exists():run(['git','clone','--depth','1',item['url']+'.git',str(folder)],root)
  if name=='SvdStudio':project=folder/'SvdStudio/SvdStudio.csproj'
  elif name=='WpfDigitalClockAlarm':project=folder/'WpfDigitalClockAlarm/WpfDigitalClockAlarm.csproj'
  else:project=next(folder.glob('*.csproj'))
  (folder/'fixtures').mkdir(exist_ok=True)
  if name!='procedural-planet-explorer':
   sized=helper.replace('int width=Math.Max(1,(int)Math.Ceiling(view.ActualWidth)),height=Math.Max(1,(int)Math.Ceiling(view.ActualHeight));','view.Measure(new Size(1440,900));view.Arrange(new Rect(0,0,1440,900));view.UpdateLayout();int width=1440,height=900;')
   (project.parent/'GalleryCapture.cs').write_text(sized,encoding='utf-8')
   if name=='SvdStudio':
    xaml=project.parent/'MainWindow.xaml';xaml.write_text(xaml.read_text(encoding='utf-8').replace('<TabControl Grid.Column="2">','<TabControl Grid.Column="2" SelectedIndex="1">'),encoding='utf-8')
   source=folder/'Program.cs'
   if source.exists():
    text=source.read_text(encoding='utf-8')
    if name=='markdown-note-graph':text=text.replace('Environment.CurrentDirectory','System.IO.Path.Combine(Environment.CurrentDirectory,"examples")').replace('loading=false;Draw();}catch','loading=false;list.SelectedIndex=0;Draw();}catch')
    if name=='log-timeline-studio':
     fixture='\n'.join(json.dumps({'timestamp':f'2026-11-06T10:{i:02d}:00Z','level':['info','info','warn','error','info'][i%5],'message':['Import pipeline started','Validated 128 records','Retrying slow upstream response','Rejected malformed event: missing identifier','Batch committed successfully'][i%5]})for i in range(18));(folder/'fixtures/demo.jsonl').write_text(fixture)
     text=text.replace('app.Run(w);','rows=File.ReadAllLines("fixtures/demo.jsonl").Select((s,i)=>Parse(s,i+1)).ToList();Draw();app.Run(w);')
    if name=='csv-cleanup-studio':text=text.replace('app.Run(w);','rows=Parse("Account,Region,Status,Revenue\\nAcme Studio,North,Active,12800\\nHarbor Systems,West,Active,9450\\nWave Labs,East,Review,7200\\nCedar Works,South,Active,6100\\n");Draw();app.Run(w);')
    if name=='local-clipboard-history':text=text.replace('app.Run(w);','h.Add("git status --short");h.Add("Customer import: 128 rows validated");h.Add("SELECT region, SUM(revenue) FROM accounts GROUP BY region;");Draw();app.Run(w);')
    source.write_text(text,encoding='utf-8')
  run(['dotnet','build',str(project),'-c','Release','--nologo'],folder,360)
  env=dict(os.environ,SC_SCREENSHOT=str(png),DOTNET_CLI_TELEMETRY_OPTOUT='1')
  log=open(out/(name+'.log'),'w',encoding='utf-8');proc=subprocess.Popen(['dotnet','run','--project',str(project),'-c','Release','--no-build'],cwd=folder,env=env,stdout=log,stderr=log)
  try:
   if name=='procedural-planet-explorer':
    from playwright.sync_api import sync_playwright
    with sync_playwright()as pw:
     browser=pw.chromium.launch();page=browser.new_page(viewport={'width':1440,'height':950})
     for attempt in range(60):
      try:page.goto('http://localhost:5080',wait_until='networkidle');break
      except Exception:time.sleep(1)
     page.locator('#map').click(position={'x':300,'y':150});page.screenshot(path=str(png));browser.close()
   else:
    deadline=time.monotonic()+90
    while time.monotonic()<deadline and not png.exists() and proc.poll()is None:time.sleep(.5)
    if not png.exists():raise RuntimeError('No WPF capture; '+(out/(name+'.log')).read_text(encoding='utf-8')[-2000:])
  finally:
   if proc.poll()is None:subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],capture_output=True)
   log.close()
  (out/(name+'.json')).write_text(json.dumps({'name':name,'kind':'runtime','caption':'Actual application interface with synthetic demo data.','platform':'Windows'}),encoding='utf-8')
  print('CAPTURED',name,flush=True)
 except Exception as e:
  (out/(name+'.error.txt')).write_text(str(e),encoding='utf-8');print('CAPTURE FAILED',name,str(e)[-300:],flush=True)
