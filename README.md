# scoolyz.com

The public site of Scoolyz, published by GitHub Pages: the **school directory** the apps read, the **privacy
policy**, the **account deletion** page, a home page, and the Windows app's releases. This repository is public and
holds no secrets and no app source code (that is in the private SIMS repository).

| Path | What |
|---|---|
| `schools.json` | **The one file to edit to add a school** |
| `site/` | The pages, published as they are (`/`, `/ar/`, `/privacy/`, `/privacy/ar/`, `/delete-account/`, `/delete-account/ar/`, `/404.html`) |
| `site/logos/` | School logos (`logos/<code>.png`, referenced from `schools.json`) |
| `site/updates/` | Windows releases: `latest.json`, the installer, its `.sig` (none yet) |
| `build.mjs` | Builds `_site/`: the pages + `/directory/<code>.json` + `/directory/index.json` + `/download/windows/` |
| `test/build.test.mjs` | Checks `schools.json` and the build (`node --test test/build.test.mjs`) |
| `serve.mjs` | A local stand-in for testing the apps (`node build.mjs --dev && node serve.mjs`) |
| `.github/workflows/pages.yml` | Test, build and publish on every push to `main` |

## Add a school

1. Make sure `https://<code>.scoolyz.com` answers (a DNS record for it pointing at the school's server, below).
2. Add it to `schools.json`:

   ```json
   {
     "code": "lycee-example",
     "name": "Lycée Example",
     "name_ar": "ثانوية المثال",
     "url": "https://lycee-example.scoolyz.com",
     "logo": "logos/lycee-example.png"
   }
   ```

   `code`: 2–32 of a–z, 0–9, `-`; never reuse one. `url`: `https://<something>.scoolyz.com` only. `logo` (optional):
   put the PNG in `site/logos/`. Optional `min_mobile_version` / `min_desktop_version` (`x.y.z`) send older apps
   to update. Optional `"unlisted": true` (a boolean, default `false`): the school still gets its own
   `/directory/<code>.json`, so typing its exact code or scanning its QR works, but it is left out of
   `/directory/index.json`, the list the apps search by name, so it cannot be found by browsing or name search.
3. Commit and push to `main`. The workflow checks the file; if it finds a mistake it fails, says which line, and
   the live site stays as it was. After about a minute the school can be found in the apps.

## First-time setup (once)

### 1. The GitHub repository

1. On GitHub: **New repository** → name `scoolyz-site`, **Public**, no README (this folder has one).
2. In this folder:
   ```bash
   git remote add origin https://github.com/HaidarMortada/scoolyz-site.git
   git push -u origin main
   ```
3. Repository → **Settings → Pages**:
   - **Build and deployment → Source: GitHub Actions**.
   - **Custom domain:** `scoolyz.com` → Save. (GitHub checks the DNS; it can take a few minutes after step 2.)
     With the GitHub Actions source this setting is what counts; the build also writes `_site/CNAME` with
     `scoolyz.com`, which GitHub ignores in that mode.
   - When the check passes: tick **Enforce HTTPS** (the certificate can take up to an hour the first time).
4. Recommended, against domain takeover: your GitHub **Settings (account) → Pages → Add a verified domain** →
   `scoolyz.com`. GitHub shows a TXT record to add (below).
5. **Actions → Publish scoolyz.com → Run workflow** (or push any commit) for the first publish.

### 2. DNS for scoolyz.com in Hostinger

hPanel → **Domains → scoolyz.com → DNS / Nameservers → DNS records**.

**Remove** the parking records for the apex and `www` (an `A @` to 2.57.91.91 or similar, and a `CNAME www` to a
parking host). **Do not touch** the records of the schools (`demo`, `alzahraa`, …) or any MX (email) records.

**Add:**

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | @ | 185.199.108.153 | 3600 |
| A | @ | 185.199.109.153 | 3600 |
| A | @ | 185.199.110.153 | 3600 |
| A | @ | 185.199.111.153 | 3600 |
| AAAA | @ | 2606:50c0:8000::153 | 3600 |
| AAAA | @ | 2606:50c0:8001::153 | 3600 |
| AAAA | @ | 2606:50c0:8002::153 | 3600 |
| AAAA | @ | 2606:50c0:8003::153 | 3600 |
| CNAME | www | haidarmortada.github.io | 3600 |
| TXT | _github-pages-challenge-HaidarMortada | (the value GitHub shows in step 1.4) | 3600 |

**Schools stay on their own servers:** `demo` → A 2.24.56.129 (as today), `alzahraa` → A (Al Zahraa's server's
IP). If there is a wildcard `*` record pointing at parking, delete it, so a mistyped school name doesn't land on
a parking page.

Check (a few minutes to an hour later):

```bash
nslookup scoolyz.com                                    # the four 185.199.x.153 addresses
curl -I https://scoolyz.com/directory/demo.json         # 200, content-type: application/json
curl -I https://scoolyz.com/directory/nope.json         # 404
```

## The deletion request form: how requests arrive

`/delete-account/` has a form that writes the request as an **email** (a `mailto:` link) to rabihmtd@gmail.com,
and shows the same text to copy when the phone has no mail app set up. There is no server.

- **Good:** no backend and no third party; requests land in your inbox with the sender's address to reply to.
- **Less good:** it depends on the visitor's mail app (the copy-paste fallback covers that), and spam bots can find
  the address on the page.

Better options if volume grows:
- **Google Forms:** free, no code, answers in a Sheet, email alerts. Google holds the requests; link it from the page.
- **Formspree / Basin** (free tier): the same form posts to them, they forward by email, with spam filtering.
- **A small endpoint on the demo server:** full control, but a server to maintain, and the page then depends on it.

Google accepts any of these, as long as the page lets people ask without the app and says what is deleted.

## Windows releases

The Windows app checks `https://scoolyz.com/updates/latest.json`. To publish a release, add the installer
(`Scoolyz_x.y.z_x64-setup.exe`) and its `.sig` to `site/updates/`, push, wait for the publish, then add or replace
`site/updates/latest.json` and push again (the SIMS repository's `desktop/RELEASE.md`, steps 5–6). Keep only the
current and previous installers (GitHub Pages sites should stay under 1 GB, files under 100 MB). `/download/windows`
always forwards to the installer in `latest.json`.

## Local testing with the apps

```bash
node build.mjs --dev && node serve.mjs    # schools.dev.json (http://localhost:8001) on http://127.0.0.1:8090
```

Debug builds of the apps read `http://localhost:8090/directory/`.
