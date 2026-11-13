// Builds scoolyz.com: the static pages in site/, plus the school directory the Scoolyz apps read.
//
//   node build.mjs          schools.json      -> _site/      (what GitHub Pages publishes)
//   node build.mjs --dev    schools.dev.json  -> _site-dev/  (local testing: http://localhost allowed)
//
// The directory: /directory/<code>.json for each school (the apps look a code up there) and /directory/index.json
// (the list the apps search by name; a school with "unlisted": true keeps its <code>.json but is left out of it).
// No dependencies: plain Node 20+.

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CODE = /^[a-z0-9-]{2,32}$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?$/;
const KEYS = ['code', 'name', 'name_ar', 'url', 'logo', 'min_desktop_version', 'min_mobile_version', 'unlisted'];
const NAME_MAX = 200;

function isScoolyzSubdomain(host) {
  return host.endsWith('.scoolyz.com') && host.length > '.scoolyz.com'.length;
}

/** The origin of a school's URL, or null: https://<school>.scoolyz.com (dev: also http://localhost:port). */
export function schoolOrigin(value, { dev = false } = {}) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    return null;
  }
  if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) return null;
  const host = url.hostname.toLowerCase();
  if (url.protocol === 'https:' && !url.port && isScoolyzSubdomain(host)) return `https://${host}`;
  if (dev && ['localhost', '127.0.0.1'].includes(host) && ['http:', 'https:'].includes(url.protocol)) {
    return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`;
  }
  return null;
}

/** A logo: "logos/<file>" kept in this repository, or an https URL on scoolyz.com or a school's subdomain. */
function logoUrl(value, { base, siteDir }) {
  if (value == null || value === '') return { url: null };
  const text = String(value).trim();
  if (/^logos\/[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp|svg)$/.test(text)) {
    if (siteDir && !existsSync(join(siteDir, text))) return { problem: `site/${text} does not exist` };
    return { url: new URL(text, base.endsWith('/') ? base : `${base}/`).href };
  }
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if (url.protocol === 'https:' && !url.port && (host === 'scoolyz.com' || isScoolyzSubdomain(host))) {
      return { url: url.href };
    }
  } catch {
    // falls through
  }
  return { problem: 'a logo is "logos/<file>.png" (in this repository) or an https address on scoolyz.com' };
}

/**
 * The directory entries of a parsed schools.json, checked. Every problem at once, so one run fixes the file.
 * @returns {{ entries: object[], problems: string[] }}
 */
export function entries(data, { dev = false, base = 'https://scoolyz.com', siteDir = null } = {}) {
  const problems = [];
  const list = data?.schools;
  if (!Array.isArray(list)) return { entries: [], problems: ['schools.json needs {"schools": [ ... ]}'] };

  const seen = new Set();
  const result = [];
  list.forEach((school, i) => {
    const at = `schools[${i}]${school?.code ? ` (${school.code})` : ''}`;
    if (!school || typeof school !== 'object' || Array.isArray(school)) {
      problems.push(`${at}: each school is an object {"code", "name", "url", ...}`);
      return;
    }
    for (const key of Object.keys(school)) {
      if (!KEYS.includes(key)) problems.push(`${at}.${key}: unknown key (typo?)`);
    }
    const code = typeof school.code === 'string' ? school.code.trim() : '';
    if (!CODE.test(code)) problems.push(`${at}.code: 2 to 32 of a-z, 0-9 and -`);
    else if (seen.has(code)) problems.push(`${at}.code: "${code}" is used twice`);
    seen.add(code);

    const name = typeof school.name === 'string' ? school.name.trim() : '';
    if (!name || name.length > NAME_MAX) problems.push(`${at}.name: required, at most ${NAME_MAX} characters`);
    const nameAr = typeof school.name_ar === 'string' ? school.name_ar.trim() : '';
    if (school.name_ar != null && (typeof school.name_ar !== 'string' || nameAr.length > NAME_MAX)) {
      problems.push(`${at}.name_ar: text, at most ${NAME_MAX} characters`);
    }

    const url = schoolOrigin(school.url, { dev });
    if (!url) problems.push(`${at}.url: https://<school>.scoolyz.com, nothing after it${dev ? ' (or http://localhost:port)' : ''}`);

    const logo = logoUrl(school.logo, { base, siteDir });
    if (logo.problem) problems.push(`${at}.logo: ${logo.problem}`);

    const versions = {};
    for (const key of ['min_desktop_version', 'min_mobile_version']) {
      const version = school[key] ?? null;
      if (version !== null && (typeof version !== 'string' || !VERSION.test(version))) {
        problems.push(`${at}.${key}: x.y.z, or leave it out`);
      }
      versions[key] = version;
    }

    if (school.unlisted != null && typeof school.unlisted !== 'boolean') {
      problems.push(`${at}.unlisted: true or false, or leave it out`);
    }

    result.push({
      code,
      name,
      ...(nameAr ? { name_ar: nameAr } : {}),
      url,
      ...(logo.url ? { logo: logo.url } : {}),
      min_desktop_version: versions.min_desktop_version,
      min_mobile_version: versions.min_mobile_version,
      ...(school.unlisted === true ? { unlisted: true } : {}),
    });
  });
  return { entries: problems.length ? [] : result, problems };
}

/**
 * Writes <out>/directory/<code>.json for every school and <out>/directory/index.json for the listed ones: an
 * unlisted school can be found by its exact code (or QR) but not by browsing or searching by name.
 */
export function writeDirectory(list, out) {
  const dir = join(out, 'directory');
  mkdirSync(dir, { recursive: true });
  for (const { unlisted, ...entry } of list) {
    // The flag stays out of the per-school file: apps only need the school's own details.
    writeFileSync(join(dir, `${entry.code}.json`), `${JSON.stringify(entry, null, 2)}\n`);
  }
  const index = {
    schools: list
      .filter((entry) => !entry.unlisted)
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
      .map(({ code, name, name_ar, url, logo }) => ({ code, name, ...(name_ar ? { name_ar } : {}), url, ...(logo ? { logo } : {}) })),
  };
  writeFileSync(join(dir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
}

/**
 * /download/windows: the link schools give families for the Windows app. GitHub Pages cannot answer with a 302, so
 * this is a page that forwards to the installer named in updates/latest.json (or says it is not out yet).
 */
export function downloadPage(latest) {
  const url = latest?.platforms?.['windows-x86_64']?.url;
  const safe = typeof url === 'string' && /^https:\/\/scoolyz\.com\/updates\/Scoolyz_[0-9A-Za-z.+-]+_x64-setup\.exe$/.test(url);
  const head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Scoolyz for Windows</title><link rel="stylesheet" href="/assets/site.css">';
  if (!safe) {
    return `${head}</head><body><main><section class="card"><h1>Scoolyz for Windows</h1><p>The Windows app is not available yet. Use Scoolyz in your browser, at your school's address.</p></section></main></body></html>\n`;
  }
  return `${head}<meta http-equiv="refresh" content="0; url=${url}"></head><body><main><section class="card"><h1>Scoolyz for Windows</h1><p>Your download should start. If it doesn't, <a href="${url}">download Scoolyz ${String(latest.version ?? '')}</a>.</p></section></main></body></html>\n`;
}

function writeDownloadPage(siteDir, out) {
  let latest = null;
  try {
    latest = JSON.parse(readFileSync(join(siteDir, 'updates', 'latest.json'), 'utf8'));
  } catch {
    // No Windows release published yet.
  }
  const dir = join(out, 'download', 'windows');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), downloadPage(latest));
}

function main() {
  const dev = process.argv.includes('--dev');
  const source = join(ROOT, dev ? 'schools.dev.json' : 'schools.json');
  const out = join(ROOT, dev ? '_site-dev' : '_site');
  const base = dev ? 'http://localhost:8090' : 'https://scoolyz.com';
  const siteDir = join(ROOT, 'site');

  let data;
  try {
    data = JSON.parse(readFileSync(source, 'utf8'));
  } catch (error) {
    console.error(`${source} is not valid JSON: ${error.message}`);
    process.exit(1);
  }
  const { entries: list, problems } = entries(data, { dev, base, siteDir });
  if (problems.length) {
    console.error(`${source} has problems:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }

  rmSync(out, { recursive: true, force: true });
  cpSync(siteDir, out, { recursive: true });
  writeDirectory(list, out);
  writeDownloadPage(siteDir, out);
  // GitHub Pages: serve files as they are (no Jekyll), so folders starting with "_" or "." would also work.
  writeFileSync(join(out, '.nojekyll'), '');
  // The custom domain. With "Source: GitHub Actions" GitHub reads it from Settings -> Pages, not from this file;
  // it is here so the published site says which domain it belongs to, whichever way Pages is set up.
  if (!dev) writeFileSync(join(out, 'CNAME'), 'scoolyz.com\n');
  console.log(`${list.length} school(s) -> ${out}: ${list.map((s) => s.code).join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
