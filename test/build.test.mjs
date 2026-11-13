// node --test test/
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { entries, schoolOrigin, writeDirectory } from '../build.mjs';

test('school addresses are https://<school>.scoolyz.com only', () => {
  assert.equal(schoolOrigin('https://alzahraa.scoolyz.com'), 'https://alzahraa.scoolyz.com');
  assert.equal(schoolOrigin('https://ALZAHRAA.scoolyz.com/'), 'https://alzahraa.scoolyz.com');
  assert.equal(schoolOrigin('https://scoolyz.com'), null, 'the apex is not a school');
  assert.equal(schoolOrigin('https://www.alzahraa.edu.lb'), null, 'no custom domains');
  assert.equal(schoolOrigin('http://alzahraa.scoolyz.com'), null);
  assert.equal(schoolOrigin('https://alzahraa.scoolyz.com:8443'), null);
  assert.equal(schoolOrigin('https://alzahraa.scoolyz.com/en'), null, 'no path');
  assert.equal(schoolOrigin('https://evilscoolyz.com'), null);
  assert.equal(schoolOrigin('http://localhost:8001'), null);
  assert.equal(schoolOrigin('http://localhost:8001', { dev: true }), 'http://localhost:8001');
});

test('the real schools.json is valid and holds the demo and Al Zahraa', () => {
  const data = JSON.parse(readFileSync(new URL('../schools.json', import.meta.url), 'utf8'));
  const { entries: list, problems } = entries(data, { siteDir: new URL('../site', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') });
  assert.deepEqual(problems, []);
  const codes = list.map((s) => s.code);
  assert.ok(codes.includes('demo'));
  assert.ok(codes.includes('alzahraa'));
  assert.equal(list.find((s) => s.code === 'alzahraa').unlisted, true, 'Al Zahraa is unlisted');
  assert.equal(list.find((s) => s.code === 'demo').unlisted, undefined, 'the demo school stays listed');
});

test('every problem is reported at once', () => {
  const { entries: list, problems } = entries({
    schools: [
      { code: 'ok', name: 'OK', url: 'https://ok.scoolyz.com' },
      { code: 'ok', name: 'Twice', url: 'https://two.scoolyz.com' },
      { code: 'Bad Code', name: '', url: 'https://x.example', colour: 'red' },
      { code: 'ver', name: 'V', url: 'https://v.scoolyz.com', min_mobile_version: '2', logo: 'https://cdn.example/x.png' },
    ],
  });
  assert.deepEqual(list, [], 'nothing is written while there are problems');
  assert.equal(problems.length, 7, problems.join('\n'));
});

test('the directory files are written: one per school and the list', () => {
  const out = mkdtempSync(join(tmpdir(), 'scoolyz-site-'));
  const { entries: list } = entries({
    schools: [
      { code: 'zeta', name: 'Zeta', url: 'https://zeta.scoolyz.com', min_mobile_version: '1.2.0' },
      { code: 'alpha', name: 'Alpha', name_ar: 'ألفا', url: 'https://alpha.scoolyz.com', logo: 'https://scoolyz.com/logos/a.png' },
    ],
  });
  writeDirectory(list, out);
  assert.deepEqual(readdirSync(join(out, 'directory')).sort(), ['alpha.json', 'index.html', 'index.json', 'zeta.json']);
  const zeta = JSON.parse(readFileSync(join(out, 'directory', 'zeta.json'), 'utf8'));
  assert.equal(zeta.min_mobile_version, '1.2.0');
  const index = JSON.parse(readFileSync(join(out, 'directory', 'index.json'), 'utf8'));
  assert.deepEqual(index.schools.map((s) => s.code), ['alpha', 'zeta'], 'sorted by name');
  assert.equal(index.schools[0].name_ar, 'ألفا');
  assert.equal(index.schools[1].min_mobile_version, undefined, 'the list carries no minimums');
});

test('the Windows download page forwards only to a scoolyz.com installer', async () => {
  const { downloadPage } = await import('../build.mjs');
  const ok = downloadPage({ version: '1.2.0', platforms: { 'windows-x86_64': { url: 'https://scoolyz.com/updates/Scoolyz_1.2.0_x64-setup.exe' } } });
  assert.match(ok, /url=https:\/\/scoolyz\.com\/updates\/Scoolyz_1\.2\.0_x64-setup\.exe/);
  assert.doesNotMatch(downloadPage(null), /refresh/);
  assert.doesNotMatch(downloadPage({ platforms: { 'windows-x86_64': { url: 'https://evil.example/x.exe' } } }), /refresh/);
});

test('an unlisted school has its own file but is not in the list; a listed one is in both', () => {
  const out = mkdtempSync(join(tmpdir(), 'scoolyz-site-'));
  const { entries: list, problems } = entries({
    schools: [
      { code: 'shown', name: 'Shown', url: 'https://shown.scoolyz.com' },
      { code: 'explicit', name: 'Explicit', url: 'https://explicit.scoolyz.com', unlisted: false },
      { code: 'hidden', name: 'Hidden', url: 'https://hidden.scoolyz.com', unlisted: true },
    ],
  });
  assert.deepEqual(problems, []);
  writeDirectory(list, out);
  assert.deepEqual(readdirSync(join(out, 'directory')).sort(), ['explicit.json', 'hidden.json', 'index.html', 'index.json', 'shown.json']);
  const index = JSON.parse(readFileSync(join(out, 'directory', 'index.json'), 'utf8'));
  assert.deepEqual(index.schools.map((s) => s.code), ['explicit', 'shown']);
  const hidden = JSON.parse(readFileSync(join(out, 'directory', 'hidden.json'), 'utf8'));
  assert.equal(hidden.code, 'hidden');
  assert.equal(hidden.url, 'https://hidden.scoolyz.com');
  assert.equal(hidden.unlisted, undefined, 'the flag is not published in the school file');
});

test('unlisted must be a boolean', () => {
  for (const bad of ['true', 1, 0, 'yes', [], {}]) {
    const { entries: list, problems } = entries({ schools: [{ code: 'x1', name: 'X', url: 'https://x1.scoolyz.com', unlisted: bad }] });
    assert.deepEqual(list, []);
    assert.equal(problems.length, 1, JSON.stringify(bad));
    assert.match(problems[0], /unlisted/);
  }
  const { problems } = entries({ schools: [{ code: 'x1', name: 'X', url: 'https://x1.scoolyz.com', unlisted: null }] });
  assert.deepEqual(problems, [], 'null is the same as leaving it out');
});

test('/directory/ is a plain page that names no school', () => {
  const out = mkdtempSync(join(tmpdir(), 'scoolyz-site-'));
  const { entries: list } = entries({ schools: [{ code: 'hiddenschool', name: 'Hidden School', url: 'https://hiddenschool.scoolyz.com', unlisted: true }] });
  writeDirectory(list, out);
  const page = readFileSync(join(out, 'directory', 'index.html'), 'utf8');
  assert.match(page, /noindex/);
  assert.doesNotMatch(page, /hiddenschool|Hidden School|index\.json/);
});

// Every page and script of the public site (site/), as visitors get them.
function siteFiles(dir = new URL('../site/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? siteFiles(join(dir, d.name)) : [join(dir, d.name)]));
}

test('no page of the site fetches or links the school list, and none shows the old contact address', () => {
  for (const file of siteFiles().filter((f) => /\.(html|js|css|json)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /index\.json/, `${file} mentions the school list`);
    assert.doesNotMatch(text, /rabihmtd@/, `${file} still shows the old address`);
  }
});

test('the terms of use exist in en/ar, link each other, and every footer links them', () => {
  const root = new URL('../site/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  for (const [page, lang, other, heading] of [
    ['terms/index.html', 'en', 'https://scoolyz.com/terms/ar/', 'Terms of use'],
    ['terms/ar/index.html', 'ar', 'https://scoolyz.com/terms/', 'شروط الاستخدام'],
  ]) {
    const html = readFileSync(join(root, page), 'utf8');
    assert.match(html, new RegExp(`<html lang="${lang}"`), page);
    assert.ok(html.includes(`href="${other}"`), `${page} links its other language`);
    assert.ok(html.includes(`<h1>${heading}</h1>`), page);
    assert.ok(html.includes('mailto:haidarmortada30@gmail.com'), page);
    assert.ok(html.includes(lang === 'en' ? 'Lebanon' : 'لبنان'), `${page} names the governing law`);
  }
  for (const [page, href] of [
    ['index.html', '/terms/'], ['ar/index.html', '/terms/ar/'],
    ['privacy/index.html', '/terms/'], ['privacy/ar/index.html', '/terms/ar/'],
    ['delete-account/index.html', '/terms/'], ['delete-account/ar/index.html', '/terms/ar/'],
  ]) {
    const footer = readFileSync(join(root, page), 'utf8').split('<footer>')[1] ?? '';
    assert.ok(footer.includes(`href="${href}"`), `${page} footer links ${href}`);
  }
});

test('the deletion form asks for a school code (en/ar) and never lists schools', () => {
  const root = new URL('../site/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  for (const [page, label, unknown] of [
    ['delete-account/index.html', 'School code', "We couldn't find that school code. Check it with your school."],
    ['delete-account/ar/index.html', 'رمز المدرسة', 'لم نجد رمز المدرسة هذا. تحقّق منه لدى مدرستك.'],
  ]) {
    const html = readFileSync(join(root, page), 'utf8');
    assert.match(html, /<input id="school"/, page);
    assert.doesNotMatch(html, /<select id="school"/, page);
    assert.ok(html.includes(`<label for="school">${label}</label>`), page);
    assert.ok(html.includes(unknown.replace("'", "\'")) || html.includes(unknown), page);
    assert.ok(html.includes('haidarmortada30@gmail.com'), page);
  }
  const js = readFileSync(join(root, 'assets/delete-account.js'), 'utf8');
  assert.match(js, /\/directory\/\$\{encodeURIComponent\(code\)\}\.json/);
  assert.doesNotMatch(js, /index\.json|<option|createElement\('option'\)/);
  assert.match(js, /const TO = 'haidarmortada30@gmail\.com'/);
});
