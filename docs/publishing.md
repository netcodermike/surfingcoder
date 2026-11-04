# SurfingCoder editing and publication setup

Prepared November 3, 2026. Repository: https://github.com/netcodermike/surfingcoder.

## What is already prepared

- Local clone of the existing repository (substitute your checkout path in the commands below).
- HTTPS Git remote for the existing repository.
- Local author identity based on the repository owner's public GitHub no-reply identity.
- A `setup/publishing` branch for these setup changes.
- Dependency-free HTML and local-link checks in `scripts/check_site.py`.
- `.nojekyll` for the plain static site and `.gitignore` for local development files.
- Project instructions in `AGENTS.md` so future editing sessions have the relevant context.

The local checkout is editable. The GitHub plugin is installed and authenticated as `netcodermike`. Repository metadata reports push access, but the integration token returned HTTP 403 for a Git tree write. Browser uploads through the signed-in owner account provide the available upload route. GitHub Pages has been verified in the signed-in repository settings: it deploys `main` from `/(root)`. The custom-domain field is empty. Command-line Git write access and the domain connection still need verification.

## 1. Connect GitHub to Codex

The GitHub plugin was installed during setup. For future sessions, verify that its connection still includes `netcodermike/surfingcoder`, then inspect the available repository and publishing tools. Plugin tools may require opening a fresh chat to become available. The signed-in GitHub browser is another supported route for uploads.

Plugin access and local command-line Git authentication are separate. Connecting the plugin does not prove that this computer's Git commands can push.

## 2. Enable local Git uploads if needed

Git and Git Credential Manager are already installed. This session was denied access when enumerating Windows' stored GitHub credentials. That result does not prove you are signed out; it means the sandbox could not read the store.

If the connected plugin cannot publish the changes, open a normal PowerShell terminal on your computer, then run:

```powershell
Set-Location 'C:\path\to\surfingcoder'
git credential-manager github login --username netcodermike --browser
```

Complete GitHub's sign-in or authorization in the browser. Then test permissions without uploading files:

```powershell
git push --dry-run origin HEAD:refs/heads/setup/publishing
```

If the dry run succeeds, normal Git has write access in that terminal. Tell Codex the result; the sandbox may still require a different supported upload route. Do not copy tokens or passwords into chat. If Git reports an error, share its error text with any credentials removed.

The pending setup can then be uploaded as a branch:

```powershell
git push -u origin setup/publishing
```

Creating that branch does not normally update a Pages site configured to deploy `main`. Review the branch before merging it into the publication source.

## 3. Open this folder as a Codex local project

Add an existing local folder in Codex and select:

`C:\path\to\surfingcoder`

Give the project a recognizable name such as SurfingCoder. Future chats opened in that project can work directly on this checkout. The exact menu labels depend on your app version. This existing chat can already edit the folder through its authorized workspace.

## 4. Verify GitHub Pages before changing DNS

Open https://github.com/netcodermike/surfingcoder/settings/pages while signed in as the owner.

For this plain HTML site, the simplest publishing source is **Deploy from a branch**, branch **main**, folder **/(root)**. If an existing working deployment method is already configured, record it before changing it; do not add a second competing deployment workflow.

Confirm the default GitHub Pages site deploys and loads. The expected project-site address, before a custom domain is configured, is:

https://netcodermike.github.io/surfingcoder/

Verified November 3, 2026 in the signed-in GitHub Pages settings: source is Deploy from a branch, `main`, `/(root)`; the default Pages site is live. An unauthenticated Pages API returned 404; the signed-in settings are the authoritative configuration check.

## 5. Connect surfingcoder.com

The domain currently resolves to a parked-domain service. The following instructions assume Porkbun hosts its DNS; confirm that in your registrar account.

1. Verify ownership of `surfingcoder.com` in your GitHub account's Pages settings if prompted. GitHub generates a specific TXT record; copy that exact name/value to the DNS provider and keep it afterward.
2. In the repository's Pages settings, set **Custom domain** to `surfingcoder.com` and save it **before changing the website DNS records**. Branch-based Pages publication should add a root `CNAME` file. Fetch/pull that change before further local editing.
3. In the DNS provider, replace the conflicting parking records for the apex and `www` only. Preserve mail records, domain-verification TXT records, and other unrelated DNS entries.
4. Configure the following records. Porkbun may display a blank host field rather than `@` for the root domain.

| Type | Host | Target/value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | netcodermike.github.io |

The `www` CNAME target is the hostname only, with no `https://` and no `/surfingcoder/` path. Check for conflicting parking `ALIAS`, `ANAME`, `CNAME`, or `AAAA` records on these same web hosts. Keep unrelated subdomains intact.

5. Wait for GitHub's DNS check and certificate provisioning. Enable **Enforce HTTPS** when it becomes available.
6. Verify both `https://surfingcoder.com` and `https://www.surfingcoder.com`; GitHub should redirect the alternative hostname to the chosen custom domain.

Domain and DNS changes need access to your GitHub and registrar accounts. No registrar password or API key is needed in chat. Once you are signed in, we can work through the actual screens and verify the records.

## 6. Day-to-day editing

```powershell
Set-Location 'C:\path\to\surfingcoder'
git status
git fetch origin
git switch main
git pull --ff-only
git switch -c article/pipe-title-race
python scripts/check_site.py
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000 to preview. Stop the preview server with Ctrl+C.

Before publication:

```powershell
python scripts/check_site.py --strict
git diff --check
git diff
```

Commit and push the topic branch, review the change, then merge it into the configured Pages source when the article is ready for publication. After deployment, verify the live article and links. The publication check currently flags the pre-existing missing About page and the article's incomplete HTML document; those need to be addressed as part of preparing the article/site for launch.

## Sources

- [GitHub: custom domain configuration and official DNS targets](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [GitHub: publishing source configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub: authentication](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github)
- [OpenAI: local projects](https://learn.chatgpt.com/docs/projects)
