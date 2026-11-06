"""Capture six genuine macOS apps in ephemeral CI clones with synthetic data.

Usage (macOS): python3 scripts/capture_mac.py --output screenshots
Dependencies: Xcode/Swift command-line tools; Python Pillow. No account credentials.
Only temporary clones are instrumented. Captures use the running app's native
NSView bitmap cache; failures are explicitly labelled source previews.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import time
import traceback

PROJECTS = [
    ('searchable-screenshot-library', 'ScreenshotLibrary'),
    ('menubar-break-reminder', 'BreakReminder'),
    ('photo-metadata-inspector', 'PhotoMetadata'),
    ('batch-image-resizer', 'LocalApp'),
    ('image-palette-studio', 'LocalApp'),
    ('menubar-snippet-library', 'LocalApp'),
]

CAPTURE_SWIFT = r'''
import AppKit
import Foundation

@MainActor private var galleryCapturePending = false
@MainActor func galleryCapture(_ window: NSWindow) {
    guard let path = ProcessInfo.processInfo.environment["GALLERY_SCREENSHOT"], !galleryCapturePending else { return }
    galleryCapturePending = true
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
        window.displayIfNeeded()
        guard let view = window.contentView else { exit(3) }
        view.layoutSubtreeIfNeeded()
        view.displayIfNeeded()
        guard let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { exit(4) }
        view.cacheDisplay(in: view.bounds, to: rep)
        guard let data = rep.representation(using: .png, properties: [:]) else { exit(5) }
        do { try data.write(to: URL(fileURLWithPath: path), options: .atomic) }
        catch { fputs("Native view capture failed: \(error)\n", stderr); exit(6) }
        NSApp.terminate(nil)
    }
}
@MainActor func galleryCaptureFirstWindow() {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
        if let window = NSApp.windows.first(where: { $0.isVisible && $0.contentView != nil }) {
            window.setContentSize(NSSize(width: 1160, height: 760))
            galleryCapture(window)
        } else { exit(7) }
    }
}
'''


def command(args, cwd, timeout=180, env=None):
    result = subprocess.run(args, cwd=cwd, env=env, text=True, encoding='utf-8',
                            errors='replace', stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, timeout=timeout)
    if result.returncode:
        raise RuntimeError(' '.join(args) + '\n' + result.stdout[-16000:])
    return result.stdout


def fixture(path: Path):
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new('RGB', (1200, 760), '#f3eee4')
    draw = ImageDraw.Draw(im)
    draw.rectangle((0, 0, 1200, 100), fill='#183a47')
    draw.rectangle((0, 470, 1200, 760), fill='#376f76')
    draw.polygon([(0, 520), (250, 320), (500, 490), (760, 210), (1200, 510)], fill='#8ca895')
    draw.ellipse((900, 140, 1030, 270), fill='#e9b85e')
    fonts = ['/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Helvetica.ttc']
    font = next((ImageFont.truetype(f, 34) for f in fonts if Path(f).exists()), ImageFont.load_default())
    small = next((ImageFont.truetype(f, 24) for f in fonts if Path(f).exists()), ImageFont.load_default())
    draw.text((45, 30), 'COASTAL FIELD NOTES', fill='white', font=font)
    draw.rounded_rectangle((55, 565, 760, 700), 12, fill='#f3eee4')
    draw.text((80, 585), 'A synthetic image for a local app demonstration.', fill='#183a47', font=small)
    draw.text((80, 630), 'No private photos, accounts, or GPS data.', fill='#183a47', font=small)
    im.save(path)


def inject(repo: Path, slug: str, demo: Path):
    files = list((repo / 'Sources').rglob('*.swift'))
    source = next((p for p in files if '@main' in p.read_text()), None)
    if source is None:
        raise RuntimeError('No Swift application entry point')
    target_dir = source.parent
    (target_dir / 'GalleryCapture.swift').write_text(CAPTURE_SWIFT)
    text = source.read_text()
    environment = 'ProcessInfo.processInfo.environment["GALLERY_SCREENSHOT"] != nil'
    demo_expr = 'URL(fileURLWithPath: ProcessInfo.processInfo.environment["GALLERY_FIXTURE"]!)'

    if slug == 'searchable-screenshot-library':
        # The application's own Shot/Library models display seeded demo content.
        marker = '}.frame(minWidth: 950, minHeight: 650)'
        if marker not in text:
            raise RuntimeError('SwiftUI view capture marker changed')
        text = text.replace(marker, marker + '\n        .onAppear { Task { @MainActor in if ' + environment + ' { selected = library.shots.first; galleryCaptureFirstWindow() } } }')
        # Keep demo storage within the ephemeral checkout, not the runner's real library.
        line = 'root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("NetCoderMikeScreenshotLibrary", isDirectory: true)'
        text = text.replace(line, 'root = ProcessInfo.processInfo.environment["GALLERY_LIBRARY"].map { URL(fileURLWithPath: $0, isDirectory: true) } ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("NetCoderMikeScreenshotLibrary", isDirectory: true)')
    elif slug == 'menubar-break-reminder':
        marker = '        update()\n    }\n    func update()'
        replacement = ('        update()\n        if ' + environment + ' { clock.onBreak = true; clock.deadline = Date().addingTimeInterval(245); showBreak(); update(); if let window = panel { galleryCapture(window) } }\n    }\n    func update()')
        if marker not in text:
            raise RuntimeError('Break reminder startup marker changed')
        text = text.replace(marker, replacement, 1)
    elif slug == 'menubar-snippet-library':
        marker = 'item.button?.title="Snippets";menu()}'
        text = text.replace(marker, 'item.button?.title="Snippets";menu();if ' + environment + '{add()}}', 1)
        marker = 'alert.accessoryView=box;guard alert.runModal()'
        demo_text = json.dumps('Review changes\nRun project checks\nConfirm the release notes\nDeploy the verified build')
        replacement = ('alert.accessoryView=box;if ' + environment + '{title.stringValue="Deployment checklist";text.string=' + demo_text + ';alert.window.center();galleryCapture(alert.window);return};guard alert.runModal()')
        if marker not in text:
            raise RuntimeError('Snippet dialog marker changed')
        text = text.replace(marker, replacement, 1)
    else:
        marker = 'window.makeKeyAndOrderFront(nil);'
        if marker not in text:
            raise RuntimeError('Native window startup marker changed')
        if slug == 'photo-metadata-inspector':
            seed = ('let demoURL = ' + demo_expr + '; reports = [(demoURL, (try? inspect(demoURL)) ?? "Demo metadata unavailable")]; files.removeAllItems(); files.addItem(withTitle: demoURL.lastPathComponent); files.selectItem(at: 0); draw();')
        elif slug == 'batch-image-resizer':
            seed = ('let demoURL = ' + demo_expr + '; let destination = demoURL.deletingLastPathComponent().appendingPathComponent("resized", isDirectory:true); try? FileManager.default.createDirectory(at:destination,withIntermediateDirectories:true); let result = (try? resize(demoURL,destination,800)) ?? "Output already created"; output.string = ' + json.dumps('Completed local conversion\n\n') + ' + demoURL.lastPathComponent + " → " + result + ' + json.dumps('\nMaximum edge: 800 px · PNG output\nOriginal image unchanged',ensure_ascii=False) + ';')
        else:
            seed = ('let demoURL = ' + demo_expr + '; let values = (try? palette(demoURL)) ?? []; output.string = values.prefix(8).map { key,n in let r=((key>>8)&15)*17,g=((key>>4)&15)*17,b=(key&15)*17;return String(format:"#%02X%02X%02X · %d thumbnail pixels",r,g,b,n) }.joined(separator:' + json.dumps('\n') + ');')
        text = text.replace(marker, marker + ' if ' + environment + ' { ' + seed + ' galleryCapture(window) };', 1)
    source.write_text(text)
    return source


def source_preview(repo: Path, slug: str, output: Path, error: str):
    """An explicitly labelled source preview, never a simulated application UI."""
    from PIL import Image, ImageDraw, ImageFont
    sources = list((repo / 'Sources').rglob('*.swift'))
    source = next((p for p in sources if '@main' in p.read_text()), sources[0] if sources else None)
    im = Image.new('RGB', (1440, 1000), '#111d2c'); d = ImageDraw.Draw(im)
    fontpath = '/System/Library/Fonts/Menlo.ttc'
    title = ImageFont.truetype(fontpath, 28) if Path(fontpath).exists() else ImageFont.load_default()
    font = ImageFont.truetype(fontpath, 18) if Path(fontpath).exists() else ImageFont.load_default()
    d.rectangle((0, 0, 1440, 115), fill='#193c47')
    d.text((40, 30), slug, font=title, fill='#edeee7')
    d.text((40, 76), 'SOURCE PREVIEW · native capture unavailable', font=font, fill='#8fe0be')
    if source:
        for i, line in enumerate(source.read_text().splitlines()[:36]):
            text = f'{i+1:>3}  ' + line.expandtabs(4)
            d.text((30, 140+i*22), text[:130], font=font, fill='#b6c9dd')
    im.save(output)


def capture_one(slug, executable, root: Path, output: Path):
    repo = root / slug
    command(['git', 'clone', '--depth', '1', 'https://github.com/netcodermike/'+slug+'.git', str(repo)], root, timeout=70)
    sha = command(['git', 'rev-parse', 'HEAD'], repo).strip()
    image = output / (slug+'.png')
    record = {'name':slug, 'repository': slug, 'source_commit': sha, 'kind': 'runtime',
              'caption':'Native macOS application capture with synthetic demonstration data.',
              'capture_method': 'Running native macOS app NSView cacheDisplay bitmap',
              'fixture': 'Synthetic coastal image and synthetic text only; no private data'}
    try:
        demo = repo/'coastal-study.png'; fixture(demo)
        library = repo/'gallery-demo-library';library.mkdir()
        fixture(library/'demo-shot.png')
        # Swift Date Codable values are seconds since 2001-01-01.
        (library/'index.json').write_text(json.dumps([{'id':'demo-shot','name':'Coastal field notes.png','text':'COASTAL FIELD NOTES\nA synthetic image for a local app demonstration.\nNo private photos, accounts, or GPS data.','topic':'General','date':815616000}]))
        inject(repo,slug,demo)
        command(['swift','build','-c','release'],repo,timeout=150)
        binary=repo/'.build/release'/executable
        env=dict(os.environ,GALLERY_SCREENSHOT=str(image.resolve()),GALLERY_FIXTURE=str(demo.resolve()),GALLERY_LIBRARY=str(library.resolve()))
        process=subprocess.Popen([str(binary)],cwd=repo,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
        try:
            deadline=time.monotonic()+22
            while time.monotonic()<deadline and not image.exists() and process.poll() is None:time.sleep(.3)
            if not image.exists():
                process.terminate()
                logs,_=process.communicate(timeout=5)
                raise RuntimeError('Native app did not produce a capture\n'+logs[-4000:])
        finally:
            if process.poll() is None:process.terminate()
            try:process.communicate(timeout=5)
            except subprocess.TimeoutExpired:process.kill();process.communicate()
        from PIL import Image
        with Image.open(image) as im:
            if im.width<300 or im.height<150:raise RuntimeError('Unexpected capture dimensions')
            record['width'],record['height']=im.size
    except Exception as error:
        record.update(kind='source-preview',caption='Repository source preview; native runtime capture was unavailable.',capture_method='Actual repository source rendered as a labelled code preview',error=str(error)[-14000:])
        print(slug+' native capture failed: '+str(error),flush=True)
        source_preview(repo,slug,image,str(error))
    (output/(slug+'.json')).write_text(json.dumps(record,indent=2))
    print(slug+': '+record['kind'],flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',default='screenshots');parser.add_argument('--only',nargs='*')
    parser.add_argument('--inventory',help='Optional project inventory; captures only listed Swift projects')
    args=parser.parse_args();output=Path(args.output).resolve();output.mkdir(parents=True,exist_ok=True)
    if os.uname().sysname!='Darwin':raise SystemExit('Run on macOS with Swift/AppKit')
    with tempfile.TemporaryDirectory(prefix='surfingcoder-native-')as temporary:
        root=Path(temporary)
        allowed=None
        if args.inventory:
            inventory=json.loads(Path(args.inventory).read_text())
            allowed={r.get('name',r.get('repository')) for r in inventory}
        for slug,executable in PROJECTS:
            if allowed is not None and slug not in allowed:continue
            if args.only and slug not in args.only:continue
            try:capture_one(slug,executable,root,output)
            except Exception as error:
                print('Capture setup failed for '+slug+': '+str(error),flush=True)
                (output/(slug+'.json')).write_text(json.dumps({'name':slug,'repository':slug,'kind':'failed','caption':'Capture setup failed.','error':str(error)},indent=2))
    print('Native capture pass finished',flush=True)

if __name__=='__main__':main()
