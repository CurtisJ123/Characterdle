import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePostImagesForSave, type PendingPostImage } from '../src/lib/announcementDraftImages.ts';
import { insertPostImage, previewPostImageUrl, safePostImageUrl } from '../src/lib/postMarkdown.ts';

const first = 'announcement-image:11111111-1111-4111-8111-111111111111';
const second = 'announcement-image:22222222-2222-4222-8222-222222222222';
const unused = 'announcement-image:33333333-3333-4333-8333-333333333333';
const image = (token: string, alt = 'Image') => `![${alt}](<${token}>)`;
const publicUrl = (id: string) => `https://storage.example/${id}.png`;

function pendingImages() {
  return new Map<string, PendingPostImage>([first, second, unused].map((id, index) => [id, {
    file: new File([`image-${index}`], 'same-name.png', { type: 'image/png' }),
    previewUrl: `blob:https://characterdle.test/${index}`,
  }]));
}

test('selection inserts a unique local placeholder and only the editor can preview its owned blob URL', () => {
  const result = insertPostImage('Start. End.', 7, 7, 'Local photo', first);
  assert.equal(result.content, `Start. \n\n${image(first, 'Local photo')}\n\nEnd.`);
  const previews = new Map([[first, 'blob:https://characterdle.test/photo']]);
  assert.equal(previewPostImageUrl(first, previews), previews.get(first));
  assert.equal(previewPostImageUrl(first), '');
  assert.equal(previewPostImageUrl(second, previews), '');
  assert.equal(previewPostImageUrl('blob:https://characterdle.test/photo', previews), '');
  assert.equal(safePostImageUrl(first), '');
  assert.equal(previewPostImageUrl(first, new Map([[first, 'javascript:alert(1)']])), '');
});

test('multiple images retain their placement after reordering, including duplicate references and identical filenames', async () => {
  const pending = pendingImages(), cache = new Map<string, string>();
  const body = `Intro\n\n${image(second, 'Second')}\n\nMiddle\n\n${image(first, 'First')}\n\n${image(second, 'Again')}\n\nOutro`;
  const files: File[] = [];
  const resolved = await resolvePostImagesForSave(body, pending, cache, async file => {
    files.push(file); return { url: publicUrl(file === pending.get(first)!.file ? 'first' : 'second') };
  });
  assert.deepEqual(files, [pending.get(second)!.file, pending.get(first)!.file]);
  assert.equal(resolved, body.replaceAll(first, publicUrl('first')).replaceAll(second, publicUrl('second')));
  assert.equal(cache.size, 2);
  assert.equal(pending.size, 3);
});

test('removing all image placeholders or editing text only performs no uploads', async () => {
  let uploads = 0;
  const body = 'Text with an existing ![image](https://storage.example/old.png).';
  assert.equal(await resolvePostImagesForSave(body, pendingImages(), new Map(), async () => {
    uploads++; return { url: publicUrl('unexpected') };
  }), body);
  assert.equal(uploads, 0);
});

test('reference-style Markdown images are resolved without changing surrounding formatting', async () => {
  const body = `![First][photo]\n\n![Again][photo]\n\n[photo]: <${first}> "Photo title"\n`;
  let uploads = 0;
  const resolved = await resolvePostImagesForSave(body, pendingImages(), new Map(), async () => {
    uploads++; return { url: publicUrl('photo') };
  });
  assert.equal(uploads, 1);
  assert.equal(resolved, body.replace(first, publicUrl('photo')));
});

test('missing, malformed, or non-image placeholders fail before uploading anything', async () => {
  let uploads = 0;
  const upload = async () => { uploads++; return { url: publicUrl('unexpected') }; };
  await assert.rejects(resolvePostImagesForSave(`${image(first)}\n${image(second)}`, new Map([[first, pendingImages().get(first)!]]), new Map(), upload), /no longer available/);
  for (const body of [image('announcement-image:bad'), `\`${first}\``, `[link](${first})`, `${image(first)}\n\nPlain text ${first}`])
    await assert.rejects(resolvePostImagesForSave(body, pendingImages(), new Map(), upload));
  assert.equal(uploads, 0);
});

test('a partial upload failure retains the draft and reuses completed uploads on retry', async () => {
  const pending = pendingImages(), cache = new Map<string, string>(), files: File[] = [];
  const body = `${image(first)}\n\n${image(second)}`;
  const failedUpload = async (file: File) => {
    files.push(file);
    if (file === pending.get(second)!.file) throw new Error('Connection lost');
    return { url: publicUrl('first') };
  };
  await assert.rejects(resolvePostImagesForSave(body, pending, cache, failedUpload), /Connection lost/);
  assert.equal(cache.get(first), publicUrl('first'));
  assert.equal(cache.has(second), false);
  assert.equal(pending.get(first)!.previewUrl, 'blob:https://characterdle.test/0');
  const resolved = await resolvePostImagesForSave(body, pending, cache, async file => {
    files.push(file); return { url: publicUrl('second') };
  });
  assert.deepEqual(files, [pending.get(first)!.file, pending.get(second)!.file, pending.get(second)!.file]);
  assert.equal(resolved, body.replace(first, publicUrl('first')).replace(second, publicUrl('second')));
});

test('retry after a post-save failure does not re-upload any successfully uploaded images', async () => {
  const pending = pendingImages(), cache = new Map<string, string>();
  const body = image(first);
  let uploads = 0;
  const upload = async () => { uploads++; return { url: publicUrl('first') }; };
  const firstAttempt = await resolvePostImagesForSave(body, pending, cache, upload);
  // A failed post request leaves body, pending files, and the upload cache intact in the editor.
  assert.equal(await resolvePostImagesForSave(body, pending, cache, upload), firstAttempt);
  assert.equal(uploads, 1);
});

test('unsafe upload responses and expanded post lengths cannot be saved', async () => {
  const cache = new Map<string, string>();
  await assert.rejects(resolvePostImagesForSave(image(first), pendingImages(), cache, async () => ({ url: 'javascript:alert(1)' })), /URL/);
  assert.equal(cache.size, 0);
  const body = 'x'.repeat(99900) + '\n\n' + image(first);
  await assert.rejects(resolvePostImagesForSave(body, pendingImages(), cache, async () => ({ url: publicUrl('x'.repeat(200)) })), /post limit/);
  assert.equal(cache.size, 1);
});
