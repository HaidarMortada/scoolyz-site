// The deletion request form: no server. It fills the school list from the directory, then writes the request as an
// email (mailto:) to Scoolyz, and shows the same text to copy for anyone whose phone has no mail app set up.
// The page's own words come from <script type="application/json" id="strings">.

const TO = 'rabihmtd@gmail.com';
const strings = JSON.parse(document.getElementById('strings').textContent);
const lang = document.documentElement.lang;

const form = document.getElementById('request');
const school = document.getElementById('school');

async function loadSchools() {
  try {
    const response = await fetch('/directory/index.json', { cache: 'no-cache' });
    if (!response.ok) return;
    const { schools } = await response.json();
    for (const s of schools) {
      const option = document.createElement('option');
      option.value = s.code;
      option.textContent = (lang === 'ar' && s.name_ar) || s.name;
      option.dataset.name = s.name;
      school.insertBefore(option, school.querySelector('option[value="other"]'));
    }
  } catch {
    // The list is a convenience; "Other" with the name in the notes still works.
  }
}

function field(id) {
  return document.getElementById(id).value.trim();
}

function requestText() {
  const option = school.selectedOptions[0];
  const schoolLabel = option && option.value !== '' ? `${option.dataset.name || option.textContent} (${option.value})` : '';
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const error = document.getElementById('form-error');
  error.hidden = true;
  if (!school.value || !field('name') || !field('login') || !document.getElementById('confirm').checked) {
    error.textContent = strings.missing;
    error.hidden = false;
    return;
  }
  const body = requestText();
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

loadSchools();
