"""Capture the real Android journal after entering synthetic demo text."""
import subprocess,time,re,json,xml.etree.ElementTree as ET
from pathlib import Path
out=Path('screenshots');out.mkdir(exist_ok=True);name='offline-field-journal'
def adb(*args):return subprocess.check_output(['adb',*args])
adb('shell','am','start','-n','com.netcodermike.fieldjournal/.MainActivity');time.sleep(4)
adb('shell','uiautomator','dump','/sdcard/window.xml');xml=adb('shell','cat','/sdcard/window.xml').decode('utf-8')
fields=[n for n in ET.fromstring(xml).iter('node')if n.attrib.get('class')=='android.widget.EditText']
for field,text in zip(fields,['Morning%swalk%salong%sthe%scoast','Clear%sskies.%sSeabirds%snear%sthe%sdunes.']):
 points=list(map(int,re.findall(r'\d+',field.attrib['bounds'])));x=(points[0]+points[2])//2;y=(points[1]+points[3])//2
 adb('shell','input','tap',str(x),str(y));adb('shell','input','text',text)
adb('shell','input','keyevent','4');time.sleep(1)
(out/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
(out/(name+'.json')).write_text(json.dumps({'name':name,'kind':'runtime','caption':'Actual Android journal with synthetic field notes.','platform':'Android emulator'}))
