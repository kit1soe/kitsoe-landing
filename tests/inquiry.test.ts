import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInquiry, buildDraft, buildHandoff, type Inquiry } from '../src/lib/inquiry.ts';

const valid: Inquiry = { name: 'Анна', contact: '@annatest', project: 'Лендинг', budget: 'Пока не определён', comment: '', channel: 'telegram' };
test('accepts supported contact formats without requiring a budget or comment', () => {
  for (const contact of ['@annatest', 'https://t.me/annatest', 'anna+work@example.com', '+7 (999) 123-45-67']) assert.deepEqual(validateInquiry({ ...valid, contact }), {});
});
test('rejects empty, malformed, unsupported and excessive input', () => {
  for (const contact of ['', '   ', 'no email', 'anna@example', '@abcd', '<script>alert(1)</script>', '-------']) assert.ok(validateInquiry({ ...valid, contact }).contact);
  assert.ok(validateInquiry({ ...valid, name:' ' }).name);
  assert.ok(validateInquiry({ ...valid, name:'a'.repeat(81) }).name);
  assert.ok(validateInquiry({ ...valid, project:'unspecified' }).project);
  assert.ok(validateInquiry({ ...valid, budget:'invalid' }).budget);
  assert.ok(validateInquiry({ ...valid, comment:'a'.repeat(1201) }).comment);
});
test('draft preserves meaningful Unicode and treats markup as plain text', () => {
  const draft = buildDraft({ ...valid, name:' Анна ', comment:'Сайт для студии & запись\nПример: <b>текст</b> 🧡' });
  assert.match(draft, /Имя: Анна\n/);
  assert.match(draft, /Пример: <b>текст<\/b> 🧡/);
  assert.match(draft, /Бюджет: Пока не определён/);
  assert.throws(() => buildDraft({ ...valid, contact:'' }), /Invalid inquiry/);
});
test('Telegram and email handoffs encode data without adding query or mail headers', () => {
  const draft = buildDraft({ ...valid, comment:'&bcc=someone@example.com\n?text=другой текст # 100% + 🧡' });
  const contacts = { telegram:'custom_owner', email:'owner@example.com' };
  const telegram = new URL(buildHandoff(draft,'telegram',contacts));
  assert.equal(telegram.hostname,'t.me'); assert.equal(telegram.pathname,'/custom_owner');
  assert.equal(telegram.searchParams.get('text'),draft); assert.equal([...telegram.searchParams].length,1);
  const mail = new URL(buildHandoff(draft,'email',contacts));
  assert.equal(mail.protocol,'mailto:'); assert.equal(mail.pathname,contacts.email);
  assert.equal(mail.searchParams.get('body'),draft); assert.equal(mail.searchParams.has('bcc'),false);
  assert.equal(mail.searchParams.get('subject'),'Обсудить проект · kitsoe');
});
