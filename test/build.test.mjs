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
  assert.deepEqual(readdirSync(join(out, 'directory')).sort(), ['alpha.json', 'index.json', 'zeta.json']);
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
