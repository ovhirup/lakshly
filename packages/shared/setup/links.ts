import type { Source, Search } from './catalog';
export type Provider = 'gmail' | 'outlook' | 'other';
export type MailProvider = 'google' | 'microsoft' | 'icloud' | 'yahoo' | 'zoho' | 'other';
const grouped = (values: string[]) => values.length === 1 ? values[0] : `(${values.join(' OR ')})`;
const froms = (s: Source) => [...s.senders.addresses, ...s.senders.domains];
// Python quote(s, safe='') also escapes the five characters encodeURIComponent leaves untouched.
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
export function gmailQuery(src: Source, search: Search): string {
  const p = [`from:${grouped(froms(src))}`, ...src.senders.excludeDomains.map(x => `-from:${x}`), `subject:${grouped(search.subjectAny)}`];
  if (search.attachment) { p.push('has:attachment'); if (src.importer.formats.includes('pdf')) p.push('filename:pdf'); }
  p.push(`newer_than:${search.window}`); return p.join(' ');
}
export function outlookQuery(src: Source, search: Search): string {
  const p = [grouped(froms(src).map(x => `from:${x}`)), ...src.senders.excludeDomains.map(x => `NOT from:${x}`), grouped(search.subjectAny.map(x => `subject:${x}`))];
  if (search.attachment) p.push('hasattachments:yes'); return p.join(' AND ');
}
export function gmailUrl(email: string, query: string): string {
  return (email ? `https://mail.google.com/mail/u/?authuser=${enc(email)}` : 'https://mail.google.com/mail/u/0/') + '#search/' + enc(query);
}
const microsoft = (d: string) => ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.in', 'hotmail.co.in', 'live.in'].includes(d) || /^(hotmail|live|outlook)\./.test(d);
export function detectProvider(email: string): Provider {
  const d = email.split('@').at(-1)?.toLowerCase() ?? '';
  return ['gmail.com', 'googlemail.com'].includes(d) ? 'gmail' : microsoft(d) ? 'outlook' : 'other';
}
export function detectMailProvider(email: string): MailProvider {
  const d = email.trim().split('@').at(-1)?.toLowerCase() ?? '';
  const p = detectProvider(email.trim());
  if (p === 'gmail') return 'google'; if (p === 'outlook') return 'microsoft';
  if (['icloud.com', 'me.com', 'mac.com'].includes(d)) return 'icloud';
  if (d.startsWith('yahoo.')) return 'yahoo'; if (d.startsWith('zoho.')) return 'zoho'; return 'other';
}
export const detectPickerProvider = detectMailProvider;
export function outlookOpenUrl(email: string): string {
  return microsoft(email.split('@').at(-1)?.toLowerCase() ?? '') ? 'https://outlook.live.com/mail/0/' : 'https://outlook.office.com/mail/';
}
export function plainSearch(src: Source, search: Search): string {
  return `from ${froms(src).join(' or ')} with ${search.subjectAny.map(x => `'${x.replace(/^"|"$/g, '')}'`).join(' or ')} in the subject${search.attachment ? ', with an attachment' : ''}`;
}
