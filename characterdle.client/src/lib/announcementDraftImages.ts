import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { isLocalPostImage, localPostImagePrefix, maxPostLength, safePostImageUrl } from './postMarkdown.ts';

export interface PendingPostImage {
  file: File;
  previewUrl: string;
}

type MarkdownNode = {
  type: string;
  url?: string;
  identifier?: string;
  children?: MarkdownNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
};

interface ImageReference { token: string; start: number; end: number }
const parser = unified().use(remarkParse).use(remarkGfm);

function localImageReferences(body: string): ImageReference[] {
  const images: MarkdownNode[] = [], references: string[] = [];
  const definitions = new Map<string, MarkdownNode>();
  function visit(node: MarkdownNode) {
    if (node.type === 'image') images.push(node);
    if (node.type === 'imageReference' && node.identifier) references.push(node.identifier);
    if (node.type === 'definition' && node.identifier && !definitions.has(node.identifier)) definitions.set(node.identifier, node);
    node.children?.forEach(visit);
  }
  visit(parser.parse(body));
  const nodes = new Set([...images, ...references.map(id => definitions.get(id)).filter(node => node !== undefined)]);
  const result: ImageReference[] = [];
  for (const node of nodes) {
    const token = node.url;
    if (!token?.toLowerCase().startsWith(localPostImagePrefix)) continue;
    const start = node.position?.start.offset, end = node.position?.end.offset;
    if (!isLocalPostImage(token) || start === undefined || end === undefined) throw new Error('A local image reference is invalid. Remove it and add the image again.');
    const source = body.slice(start, end);
    const offset = source.indexOf(token);
    // Replace only an actual image destination, never similar text elsewhere in the post.
    if (offset < 0 || source.indexOf(token, offset + token.length) !== -1) throw new Error('A local image reference is ambiguous. Remove it and add the image again.');
    result.push({ token, start: start + offset, end: start + offset + token.length });
  }
  return result.sort((a, b) => a.start - b.start);
}

function replaceReferences(body: string, references: ImageReference[], resolve: (token: string) => string): string {
  let result = body;
  for (const reference of [...references].reverse())
    result = result.slice(0, reference.start) + resolve(reference.token) + result.slice(reference.end);
  return result;
}

export async function resolvePostImagesForSave(
  body: string,
  pending: ReadonlyMap<string, PendingPostImage>,
  uploaded: Map<string, string>,
  upload: (file: File) => Promise<{ url: string }>,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  if (body.length > maxPostLength) throw new Error('Post must be at most 100,000 characters.');
  const references = localImageReferences(body);
  const tokens = [...new Set(references.map(reference => reference.token))];
  for (const token of tokens) {
    if (!pending.has(token)) throw new Error('A local image is no longer available. Remove its placeholder and select the image again.');
  }
  // Never save local-only placeholders, including broken references or pasted placeholders from another editor.
  if (replaceReferences(body, references, () => '').toLowerCase().includes(localPostImagePrefix))
    throw new Error('A local image placeholder is not used as an image. Remove it or add the image again before saving.');
  const toUpload = tokens.filter(token => !uploaded.has(token));
  for (const [index, token] of toUpload.entries()) {
    onProgress?.(index + 1, toUpload.length);
    const result = await upload(pending.get(token)!.file);
    if (!safePostImageUrl(result.url) || /[<>]/.test(result.url)) throw new Error('The uploaded image URL is not supported.');
    // Retain confirmed uploads across failed saves so retrying does not upload them again.
    uploaded.set(token, result.url);
  }
  const resolved = replaceReferences(body, references, token => uploaded.get(token)!);
  if (resolved.length > maxPostLength) throw new Error('The uploaded image URLs exceed the post limit. Shorten the post and save again.');
  return resolved;
}
