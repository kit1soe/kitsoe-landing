import { buildDraft, buildHandoff, validateInquiry, type Inquiry, type Channel } from '../lib/inquiry';
import { site } from '../config/site';

const form = document.querySelector<HTMLFormElement>('#inquiry-form');
if (form) {
  const fields = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('.field input, .field select, .field textarea')];
  const message = document.querySelector<HTMLParagraphElement>('#form-message')!;
  const panel = document.querySelector<HTMLElement>('#inquiry-draft')!;
  const draftText = document.querySelector<HTMLTextAreaElement>('#draft-text')!;
  const open = document.querySelector<HTMLAnchorElement>('#draft-open')!;
  const prepare = document.querySelector<HTMLButtonElement>('#prepare-inquiry')!;
  const copyStatus = document.querySelector<HTMLElement>('#copy-status')!;
  const touched = new WeakSet<Element>();
  let submitted = false;
  let announcement: ReturnType<typeof setTimeout> | undefined;
  function readForm(): Inquiry {
    const values = new FormData(form!);
    const get = (name: string) => String(values.get(name) ?? '');
    return { name:get('name'), contact:get('contact'), project:get('project'), budget:get('budget'), comment:get('comment'), channel:get('channel') as Channel };
  }
  function showFieldError(field: typeof fields[number], error: string | undefined) {
    const errorId = `${field.name}-error`;
    const errorNode = document.getElementById(errorId);
    field.setCustomValidity(error ?? '');
    field.setAttribute('aria-invalid', error ? 'true' : 'false');
    if (errorNode) errorNode.textContent = error ?? '';
    const described = (field.getAttribute('aria-describedby') ?? '').split(' ').filter(id => id && id !== errorId);
    if (error) described.push(errorId);
    if (described.length) field.setAttribute('aria-describedby', described.join(' '));
    else field.removeAttribute('aria-describedby');
  }
  fields.forEach(field => {
    field.addEventListener('input', () => {
      clearTimeout(announcement);
      touched.add(field);
      const error = validateInquiry(readForm())[field.name as keyof Inquiry];
      if (!error) showFieldError(field, undefined);
      if (!panel.hidden) { panel.hidden = true; prepare.setAttribute('aria-expanded','false'); copyStatus.textContent=''; }
      if (submitted) message.textContent='';
    });
    field.addEventListener('blur', () => {
      if (!touched.has(field)) return;
      const error = validateInquiry(readForm())[field.name as keyof Inquiry];
      showFieldError(field,error);
      clearTimeout(announcement);
      if (error) announcement = setTimeout(() => { message.textContent = error; },500);
    });
  });
  form.addEventListener('change', () => {
    if (!panel.hidden) { panel.hidden = true; prepare.setAttribute('aria-expanded','false'); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    clearTimeout(announcement);
    submitted = true;
    const values = readForm();
    const errors = validateInquiry(values);
    fields.forEach(field => showFieldError(field,errors[field.name as keyof Inquiry]));
    if (Object.keys(errors).length) {
      panel.hidden = true;
      prepare.setAttribute('aria-expanded','false');
      message.textContent = 'Проверьте выделенные поля. Обращение пока не подготовлено.';
      fields.find(field => errors[field.name as keyof Inquiry])?.focus();
      return;
    }
    message.textContent = '';
    const draft = buildDraft(values);
    draftText.value = draft;
    open.href = buildHandoff(draft,values.channel,site);
    open.textContent = values.channel === 'telegram' ? 'Открыть Telegram ↗' : 'Открыть почту ↗';
    open.target = values.channel === 'telegram' ? '_blank' : '_self';
    copyStatus.textContent = '';
    panel.hidden = false;
    prepare.setAttribute('aria-expanded','true');
    document.getElementById('draft-title')?.focus({preventScroll:true});
    panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'nearest'});
  });
  document.getElementById('draft-copy')?.addEventListener('click',async () => {
    try {
      await navigator.clipboard.writeText(draftText.value);
      copyStatus.textContent='Текст скопирован. Вставьте его в выбранный чат или письмо.';
    } catch {
      draftText.focus(); draftText.select();
      copyStatus.textContent='Не удалось скопировать автоматически. Текст выделен: скопируйте его вручную.';
    }
  });
  form.noValidate = true;
  prepare.disabled = false;
}
