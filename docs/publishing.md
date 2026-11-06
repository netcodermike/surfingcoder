# Publishing SurfingCoder

The user authorized the public repository gallery and custom-domain launch on November 6, 2026. Publishing a commit to `main` updates the public website.

## Deployment configuration

- Repository: [netcodermike/surfingcoder](https://github.com/netcodermike/surfingcoder), public.
- GitHub Pages: deploy from branch `main`, folder `/(root)`.
- Custom domain: `surfingcoder.com`, recorded in the root `CNAME` file.
- Canonical URL: https://surfingcoder.com.
- The existing domain DNS points to GitHub Pages. No registrar changes are needed for this launch.

The site is plain HTML/CSS/JavaScript with `.nojekyll`. There is no competing deployment workflow, server, database, or required framework build. Screenshot workflows are optional asset-generation tools; they are separate from Pages publication.

## Editing workflow

Use established GitHub authentication through Git Credential Manager or an authorized GitHub integration. Never store credentials in this repository or paste them into chat.

```powershell
git status
git fetch origin
git switch main
git pull --ff-only
git switch -c site/your-change
python scripts/build_gallery.py
python scripts/check_site.py --strict
python scripts/check_gallery.py
python -m http.server 8000 --bind 127.0.0.1
```

Preview http://127.0.0.1:8000, test desktop and mobile layouts, search/filter/reset, both views, and screenshot dialogs. Check `git diff --check` and review the actual diff. Commit/push the topic branch, then merge reviewed work to `main`. See [gallery.md](gallery.md) and [screenshots.md](screenshots.md) for content updates.

## Verify a deployment

Check the Pages deployment in the repository's Actions or Settings → Pages screen. Confirm that https://surfingcoder.com serves the new gallery, that SVD Studio and Coinbase Ladder appear first, and that screenshots and repository links load. Confirm the `www` hostname redirects to the canonical domain and that HTTPS is enforced after certificate provisioning.

If GitHub is provisioning a certificate, keep the custom domain configured while issuance finishes. Do not bypass browser certificate warnings. If DNS needs repair later, GitHub documents these apex A records:

| Host | Type | Target |
| --- | --- | --- |
| @ | A | 185.199.108.153 |
| @ | A | 185.199.109.153 |
| @ | A | 185.199.110.153 |
| @ | A | 185.199.111.153 |
| www | CNAME | netcodermike.github.io |

Preserve unrelated mail, TXT, and subdomain records. Keep any GitHub domain-verification TXT record. The `www` target has no protocol or repository path.

## Existing writing

The Pipeline analysis and supporting data retain the November 3, 2026 snapshot and review-draft wording. The gallery is the homepage; Writing and About remain linked. Updating the gallery does not revise the article's factual assumptions.

## Official references

- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Custom domains and DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [HTTPS for Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
