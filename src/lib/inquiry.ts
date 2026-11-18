export const projectTypes = ['Лендинг', 'Сайт для бизнеса', 'Приложение', 'Доработка сайта', 'Пока не знаю'] as const;
export const budgets = ['Пока не определён', 'До 50 000 ₽', '50 000 – 100 000 ₽', '100 000 – 200 000 ₽', 'От 200 000 ₽'] as const;
export type Channel = 'telegram' | 'email';
export interface Inquiry { name: string; contact: string; project: string; budget: string; comment: string; channel: Channel }
export type InquiryErrors = Partial<Record<keyof Inquiry, string>>;

export function validateInquiry(data: Inquiry): InquiryErrors {
  const errors: InquiryErrors = {};
  if (data.name.trim().length < 2 || data.name.trim().length > 80) errors.name = 'Укажите имя: от 2 до 80 символов.';
  const contact = data.contact.trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const telegram = /^(?:@|https:\/\/t\.me\/)[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(contact);
  const phone = /^\+?[\d\s()-]{7,25}$/.test(contact) && contact.replace(/\D/g, '').length >= 7;
  if (contact.length > 160 || !(email || telegram || phone)) errors.contact = 'Укажите email, @имя в Telegram или телефон с кодом страны.';
  if (!(projectTypes as readonly string[]).includes(data.project)) errors.project = 'Выберите тип проекта. Можно выбрать «Пока не знаю».';
  if (!(budgets as readonly string[]).includes(data.budget)) errors.budget = 'Выберите бюджет или «Пока не определён».';
  if (data.comment.length > 1200) errors.comment = 'Сократите комментарий до 1200 символов.';
  if (data.channel !== 'telegram' && data.channel !== 'email') errors.channel = 'Выберите Telegram или email.';
  return errors;
}

export function buildDraft(data: Inquiry): string {
  if (Object.keys(validateInquiry(data)).length) throw new Error('Invalid inquiry');
  return [
    'Здравствуйте! Хочу обсудить проект с kitsoe.',
    '',
    `Имя: ${data.name.trim()}`,
    `Контакт: ${data.contact.trim()}`,
    `Задача: ${data.project}`,
    `Бюджет: ${data.budget}`,
    ...(data.comment.trim() ? ['', `О проекте: ${data.comment.trim()}`] : []),
    '',
    'Интересует бесплатная консультация.',
  ].join('\n');
}

export function buildHandoff(draft: string, channel: Channel, contacts: { telegram: string; email: string }): string {
  if (channel === 'telegram') return `https://t.me/${contacts.telegram}?text=${encodeURIComponent(draft)}`;
  return `mailto:${contacts.email}?subject=${encodeURIComponent('Обсудить проект · kitsoe')}&body=${encodeURIComponent(draft)}`;
}
