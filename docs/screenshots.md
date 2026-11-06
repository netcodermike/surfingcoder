# Capturing project screenshots

Screenshots show actual app interfaces with synthetic demonstration data. Command-line utilities use actual command output rendered in a readable terminal frame. No screenshot connects to a user's exchange account, trades, clipboard history, personal library, or private files.

## Capture scripts

| Script | Runner and dependencies |
| --- | --- |
| `scripts/capture_windows.py` | Windows, Python, Pillow, Playwright/Chromium, .NET 8 and 10 SDKs |
| `scripts/capture_mac.py` | macOS, Swift toolchain, Python/Pillow; captures native AppKit views |
| `scripts/capture_linux.py` | Linux, Python/Pillow/Playwright/Chromium; Xvfb, openbox, wmctrl, scrot; language SDKs for the requested group |
| `scripts/capture_android.py` | Android API 35 emulator with adb and the offline-field-journal debug APK installed |

The scripts clone only the public repositories listed in `scripts/projects-inventory.json`, build them in temporary directories, seed synthetic data in those copies, and write PNG/JSON pairs to `screenshots/`. App source repositories are not modified. Use disposable CI runners: these commands build and execute the listed projects.

The Linux script supports `--group browser|python|java|kotlin|qt|cli` and optional `--only <repository...>`. Native Python apps run with `/usr/bin/python3` to match the operating system's `python3-tk`. The Windows and macOS scripts also accept `--only`.

The **Capture project interfaces** workflow can be dispatched manually. Its initial capture history used branch `site/project-gallery`; targeted refresh markers in commit messages narrowed the jobs. The **Capture Python desktop interfaces** workflow supplies a smaller Ubuntu 24.04 job for Tk apps. Artifacts contain original PNGs and provenance JSON; workflows do not automatically overwrite the live gallery.

## Publish a refreshed capture

1. Download the relevant workflow artifact, inspect the actual capture, and confirm that demonstration data is safe and representative.
2. Convert the full PNG to RGB WebP, preserving its entire interface and compositing transparent native view pixels on a white window background, at a maximum 1440 Ã— 1000 pixels and quality around 86. Do not stretch or fabricate the interface.
3. Save `assets/screenshots/<repository>.webp` with its accompanying JSON. Copy the metadata into that repository's `capture` object in `assets/projects.json`.
4. Regenerate cards with `python scripts/build_gallery.py` and run the publication checks.

`kind: runtime` means a running interface, `kind: terminal` means actual command output. Capture scripts can create a clearly labelled `source-preview` if a build fails; the gallery publication check rejects those and pending captures so they cannot silently replace runtime screenshots.

Coinbase Ladder uses its disconnected local demo calculator. Its screenshot runner blocks outbound browser requests and WebSockets, disables credential loading and order submission, and never starts the account monitor. Backup server screenshots use an isolated demo vault and obviously synthetic keys.
