export function safePostUrl(value: string): string {
  const url = value.trim();
  if ([...url].some(character => character.charCodeAt(0) <= 32 || character === '\\') || url.startsWith('//')) return '';
  return /^(https?:\/\/|mailto:|\/|#)/i.test(url) ? url : '';
}

export function safePostImageUrl(value: string): string {
  const url = safePostUrl(value);
  return /^(https:\/\/|\/)/i.test(url) ? url : '';
}

export const maxPostLength = 100000;
export const maxPostImageBytes = 5 * 1024 * 1024;
export const postImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const localPostImagePrefix = 'announcement-image:';

export function isLocalPostImage(value: string): boolean {
  return /^announcement-image:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
}

export function previewPostImageUrl(value: string, localImages?: ReadonlyMap<string, string>): string {
  const localUrl = isLocalPostImage(value) ? localImages?.get(value) : undefined;
  return localUrl?.startsWith('blob:') ? localUrl : safePostImageUrl(value);
}

export function insertPostImage(body: string, start: number, end: number, alt: string, url: string) {
  const safeUrl = isLocalPostImage(url) ? url : safePostImageUrl(url);
  if (!safeUrl || /[<>]/.test(safeUrl)) throw new Error('The image URL is not supported.');
  const description = alt.trim().replace(/\s+/g, ' ').replace(/[\\`*_[\]<>]/g, '\\$&');
  if (!description) throw new Error('Add a short image description first.');
  const insertion = `\n\n![${description}](<${safeUrl}>)\n\n`;
  const content = body.slice(0, start) + insertion + body.slice(end);
  if (content.length > maxPostLength) throw new Error('The image would exceed the 100,000-character post limit. Shorten the post first.');
  return { content, cursor: start + insertion.length };
}
