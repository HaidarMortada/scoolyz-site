// The deletion request form: no server. The person types their school's code, which is checked against that one
// school's directory entry (/directory/<code>.json, so unlisted schools work too); nothing on this page lists or
// suggests schools. The request is written as an email (mailto:) to Scoolyz, with the same text shown to copy for
// anyone whose phone has no mail app set up. The page's own words come from <script type="application/json" id="strings">.

const TO = 'haidarmortada30@gmail.com';
// The same rule as build.mjs: 2 to 32 of a-z, 0-9 and -.
const CODE = /^[a-z0-9-]{2,32}$/;
const strings = JSON.parse(document.getElementById('strings').textContent);

const form = document.getElementById('request');
const school = document.getElementById('school');
const schoolError = document.getElementById('school-error');

/** code => { status: 'ok', name } | { status: 'unknown' } (a failed connection is not remembered) */
const looked = new Map();

function schoolCode() {
  return school.value.trim().toLowerCase().replace(/\s+/g, '');
}

async function lookUp(code) {
  if (looked.has(code)) return looked.get(code);
  let result;
  if (!CODE.test(code)) {
    result = { status: 'unknown' };
  } else {
    try {
      const response = await fetch(`/directory/${encodeURIComponent(code)}.json`, { cache: 'no-cache' });
      if (response.ok) {
        const entry = await response.json();
        result = { status: 'ok', name: entry.name || code };
      } else {
        result = response.status === 404 ? { status: 'unknown' } : { status: 'unreachable' };
      }
    } catch {
      result = { status: 'unreachable' };
    }
  }
  if (result.status !== 'unreachable') looked.set(code, result);
  return result;
}

function showSchoolError(text) {
  schoolError.textContent = text;
  schoolError.hidden = !text;
  school.setAttribute('aria-invalid', text ? 'true' : 'false');
}

async function checkSchool() {
  const code = schoolCode();
  if (!code) {
    showSchoolError('');
    return { status: 'empty' };
  }
  const result = await lookUp(code);
  showSchoolError(result.status === 'unknown' ? strings.codeUnknown : '');
  return result;
}

function field(id) {
  return document.getElementById(id).value.trim();
}

function requestText(code, result) {
  let schoolLabel = strings.notListed;
  if (code && result.status === 'ok') schoolLabel = `${result.name} (${code})`;
  else if (code) schoolLabel = `${code} (${strings.notChecked})`;
  const lines = [
    strings.mailIntro,
    '',
    `${strings.school}: ${schoolLabel}`,
    `${strings.name}: ${field('name')}`,
    `${strings.login}: ${field('login')}`,
    `${strings.role}: ${document.getElementById('role').selectedOptions[0]?.textContent ?? ''}`,
    `${strings.phone}: ${field('phone') || '-'}`,
    `${strings.children}: ${document.getElementById('children').checked ? strings.yes : strings.no}`,
    '',
    `${strings.notes}:`,
    field('notes') || '-',
  ];
  return lines.join('\n');
}

school.addEventListener('blur', () => { void checkSchool(); });
school.addEventListener('input', () => showSchoolError(''));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = document.getElementById('form-error');
  error.hidden = true;
  if (!field('name') || !field('login') || !document.getElementById('confirm').checked) {
    error.textContent = strings.missing;
    error.hidden = false;
    return;
  }
  const code = schoolCode();
  if (!code && !field('notes')) {
    error.textContent = strings.codeOrNotes;
    error.hidden = false;
    school.focus();
    return;
  }
  const result = await checkSchool();
  if (result.status === 'unknown') {
    school.focus();
    return;
  }
  const body = requestText(code, result);
  const subject = `${strings.subject} - ${field('name')}`;
  document.getElementById('mail-text').textContent = `To: ${TO}\nSubject: ${subject}\n\n${body}`;
  document.getElementById('sent').hidden = false;
  window.location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.getElementById('sent').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById('mail-text').textContent);
    document.getElementById('copy').textContent = strings.copied;
  } catch {
    // The text is selectable as well.
  }
});
