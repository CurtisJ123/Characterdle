import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useUpdatesResource } from '../hooks/useUpdatesResource';
import { updateMutation, uploadAnnouncementImage } from '../services/announcementsApi';
import { insertPostImage, localPostImagePrefix, maxPostImageBytes, postImageTypes } from '../lib/postMarkdown';
import { resolvePostImagesForSave, type PendingPostImage } from '../lib/announcementDraftImages';
import type { Announcement, AnnouncementPage } from '../types/announcements';
import { PostBody } from '../components/updates/PostBody';
import { AdminComments } from '../components/admin/AdminComments';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { AdminPlayers } from '../components/admin/AdminPlayers';
import { AdminCharacters, AdminQuotes } from '../components/admin/AdminCatalog';
import { PostDate, UpdatesError, UpdatesPagination } from '../components/updates/UpdatesCommon';
import './UpdatesPage.css';
import './AdminPage.css';

type Draft = Pick<Announcement, 'title' | 'slug' | 'summary' | 'bodyMarkdown' | 'showPopup'>;
const emptyDraft: Draft = { title: '', slug: '', summary: '', bodyMarkdown: '', showPopup: false };

function PostEditor({ initial, token, onSaved, onClose }: {
  initial: Announcement | null; token: string; onSaved: () => void; onClose: () => void;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Draft>(initial ?? emptyDraft);
  const [baseline, setBaseline] = useState(JSON.stringify(initial ? pickDraft(initial) : emptyDraft));
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [pendingImages, setPendingImages] = useState<ReadonlyMap<string, PendingPostImage>>(new Map());
  const previewResources = useRef(new Set<string>());
  const uploadedImages = useRef(new Map<string, string>());
  const [imagePanel, setImagePanel] = useState(false);
  const [imageAlt, setImageAlt] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const saveLock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const imageSelection = useRef({ start: 0, end: 0 });
  const working = busy;
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dirty = JSON.stringify(pickDraft(draft)) !== baseline;
  useEffect(() => {
    const resources = previewResources.current;
    return () => { resources.forEach(url => URL.revokeObjectURL(url)); resources.clear(); };
  }, []);
  useEffect(() => {
    if (!dirty && !working) return;
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ''; }
    function beforeNavigate(event: Event) { if (working || !window.confirm('Leave without saving your changes?')) event.preventDefault(); }
    function onLink(event: MouseEvent) {
      const link = (event.target as Element).closest('a[href]');
      if (link && !link.getAttribute('href')?.startsWith('#') && (working || !window.confirm('Leave without saving your changes?'))) event.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('characterdle:before-navigate', beforeNavigate);
    document.addEventListener('click', onLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('characterdle:before-navigate', beforeNavigate);
      document.removeEventListener('click', onLink, true);
    };
  }, [dirty, working]);
  function pickDraft(value: Draft): Draft {
    return { title: value.title, slug: value.slug, summary: value.summary, bodyMarkdown: value.bodyMarkdown, showPopup: value.showPopup };
  }
  function format(prefix: string, suffix = '') {
    const input = bodyRef.current;
    if (!input) return;
    const start = input.selectionStart, end = input.selectionEnd;
    const selected = draft.bodyMarkdown.slice(start, end) || 'text';
    const bodyMarkdown = draft.bodyMarkdown.slice(0, start) + prefix + selected + suffix + draft.bodyMarkdown.slice(end);
    setDraft({ ...draft, bodyMarkdown });
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); });
  }
  async function save(status: 'draft' | 'published') {
    if (working || saveLock.current || !formRef.current?.reportValidity()) return;
    setError(''); setNotice('');
    if (!draft.title.trim()) { setError('Enter a title.'); return; }
    if (status === 'published' && (!draft.summary.trim() || !draft.bodyMarkdown.trim())) {
      setError('Add a summary and post content before publishing.'); return;
    }
    saveLock.current = true; setBusy(true); setSaveProgress('Saving post...');
    try {
      const bodyMarkdown = await resolvePostImagesForSave(draft.bodyMarkdown, pendingImages, uploadedImages.current,
        file => uploadAnnouncementImage(token, file), (current, total) => setSaveProgress(`Uploading image ${current} of ${total}...`));
      setSaveProgress('Saving post...');
      const post = await updateMutation<Announcement>(saved ? `/api/admin/updates/${saved.id}` : '/api/admin/updates', token, saved ? 'PUT' : 'POST',
        { ...pickDraft(draft), bodyMarkdown, status, expectedUpdatedAt: saved?.updatedAt ?? null });
      setSaved(post); setDraft(post); setBaseline(JSON.stringify(pickDraft(post))); onSaved();
      setPendingImages(new Map()); uploadedImages.current.clear();
      previewResources.current.forEach(url => URL.revokeObjectURL(url)); previewResources.current.clear();
      setNotice(status === 'published' ? 'Published. Your update is live.' : 'Draft saved.');
    } catch (e) { setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Image upload timed out. Your changes are still here; try saving again.'); }
    finally { saveLock.current = false; setBusy(false); setSaveProgress(''); }
  }
  function showImagePanel() {
    const input = bodyRef.current;
    if (!input) return;
    imageSelection.current = { start: input.selectionStart, end: input.selectionEnd };
    setImagePanel(!imagePanel);
  }
  function addImage(file: File) {
    if (working || saveLock.current) return;
    setError(''); setNotice('');
    if (!postImageTypes.includes(file.type)) { setError('Choose a JPEG, PNG, WebP, or GIF image.'); return; }
    if (!file.size || file.size > maxPostImageBytes) { setError('Choose a non-empty image, 5 MB or smaller.'); return; }
    const { start, end } = imageSelection.current;
    try {
      const placeholder = `${localPostImagePrefix}${crypto.randomUUID()}`;
      const inserted = insertPostImage(draft.bodyMarkdown, start, end, imageAlt, placeholder);
      const previewUrl = URL.createObjectURL(file);
      previewResources.current.add(previewUrl);
      setPendingImages(images => new Map(images).set(placeholder, { file, previewUrl }));
      setDraft(value => ({ ...value, bodyMarkdown: inserted.content }));
      setImagePanel(false); setImageAlt('');
      setNotice('Image added locally. It will upload when you save or publish.');
      requestAnimationFrame(() => { bodyRef.current?.focus(); bodyRef.current?.setSelectionRange(inserted.cursor, inserted.cursor); });
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to add image.'); }
  }
  function close() { if (!working && (!dirty || window.confirm('Discard unsaved changes?'))) onClose(); }
  function submit(event: FormEvent) { event.preventDefault(); void save(saved?.status ?? 'draft'); }
  return <section className="glass-card updates-editor">
    <div className="updates-editor-heading"><h2>{saved ? 'Edit post' : 'New post'}</h2>
      <button className="secondary-button" onClick={close} disabled={working}>Back to posts</button></div>
    <UpdatesError message={error} /><p role="status">{busy ? saveProgress : notice}</p>
    <form ref={formRef} onSubmit={submit}>
      <fieldset disabled={working}>
        <label>Title<input maxLength={160} required value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>URL slug<input maxLength={160} required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="episode-ladder-launch"
          readOnly={!!saved?.publishedAt} value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} /></label>
        <label>Summary<textarea rows={2} maxLength={600} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} /></label>
        <div className="updates-editor-toolbar" role="group" aria-label="Post formatting">
          <button type="button" disabled={preview} onClick={() => format('**', '**')}>Bold</button>
          <button type="button" disabled={preview} onClick={() => format('*', '*')}>Italic</button>
          <button type="button" disabled={preview} onClick={() => format('\n## ')}>Heading</button>
          <button type="button" disabled={preview} onClick={() => format('\n- ')}>List</button>
          <button type="button" disabled={preview} onClick={() => format('[', '](https://example.com)')}>Link</button>
          <button type="button" disabled={preview} aria-expanded={imagePanel} onClick={showImagePanel}>Add image</button>
          <button type="button" aria-pressed={preview} onClick={() => { setPreview(!preview); setImagePanel(false); }}>{preview ? 'Edit' : 'Preview'}</button>
        </div>
        {imagePanel && <div className="updates-image-upload">
          <label>Image description<input maxLength={200} value={imageAlt} placeholder="Describe the image for readers"
            onChange={event => setImageAlt(event.target.value)} /></label>
          <p>JPEG, PNG, WebP or GIF, up to 5 MB. Uploaded only when you save or publish, then publicly accessible.</p>
          <button className="secondary-button" type="button" disabled={!imageAlt.trim()} onClick={() => fileRef.current?.click()}>Choose image</button>
          <input ref={fileRef} hidden type="file" accept={postImageTypes.join(',')} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = ''; if (file) addImage(file);
          }} />
        </div>}
        {preview ? <article className="updates-preview"><h2>{draft.title}</h2><PostBody body={draft.bodyMarkdown}
          localImages={new Map([...pendingImages].map(([placeholder, image]) => [placeholder, image.previewUrl]))} /></article>
          : <label>Post content<textarea ref={bodyRef} rows={16} maxLength={100000} value={draft.bodyMarkdown}
            onSelect={event => { imageSelection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }}
            onChange={event => setDraft({ ...draft, bodyMarkdown: event.target.value })} /></label>}
        <label className="updates-checkbox"><input type="checkbox" checked={draft.showPopup} onChange={event => setDraft({ ...draft, showPopup: event.target.checked })} />Show as an announcement popup</label>
        <div className="updates-editor-actions">
          <button className="primary-button" type="submit">{busy ? 'Saving...' : saved?.status === 'published' ? 'Save changes' : 'Save draft'}</button>
          {saved?.status !== 'published' && <button className="secondary-button" type="button" onClick={() => void save('published')}>Publish</button>}
          {saved?.status === 'published' && <button className="secondary-button" type="button" onClick={() => { if (window.confirm('Unpublish this post and hide its comments from public view?')) void save('draft'); }}>Unpublish</button>}
        </div>
      </fieldset>
    </form>
  </section>;
}

function AdminWorkspace({ token }: { token: string }) {
  type Section = 'home' | 'posts' | 'comments' | 'characters' | 'quotes' | 'players';
  const [section, setSection] = useState<Section>('home');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Announcement | null | undefined>(undefined);
  const posts = useUpdatesResource<AnnouncementPage<Announcement>>(section === 'posts' ? `/api/admin/updates?page=${page}` : null, token);
  function navigate(section: Section) {
    if (!window.dispatchEvent(new Event('characterdle:before-navigate', { cancelable: true }))) return;
    setEditing(undefined); setSection(section);
  }
  return <div className="admin-layout">
    <nav className="glass-card admin-sidebar" aria-label="Administration">
      <button aria-current={section === 'home' ? 'page' : undefined} onClick={() => navigate('home')}>Home</button>
      <button aria-current={section === 'players' ? 'page' : undefined} onClick={() => navigate('players')}>Players</button>
      <button aria-current={section === 'posts' ? 'page' : undefined} onClick={() => navigate('posts')}>Posts</button>
      <button aria-current={section === 'comments' ? 'page' : undefined} onClick={() => navigate('comments')}>Comments</button>
      <button aria-current={section === 'characters' ? 'page' : undefined} onClick={() => navigate('characters')}>Characters</button>
      <button aria-current={section === 'quotes' ? 'page' : undefined} onClick={() => navigate('quotes')}>Quotes</button>
    </nav>
    <div className="admin-content">{section === 'home' ? <AdminDashboard token={token} />
      : section === 'players' ? <AdminPlayers token={token} />
      : section === 'comments' ? <AdminComments token={token} />
      : section === 'characters' ? <AdminCharacters token={token} />
      : section === 'quotes' ? <AdminQuotes token={token} />
      : editing !== undefined ? <PostEditor key={editing?.id ?? 'new'} initial={editing} token={token} onSaved={posts.reload} onClose={() => setEditing(undefined)} />
        : <section className="glass-card admin-posts">
          <div className="updates-editor-heading"><h2>Posts</h2><button className="primary-button" onClick={() => setEditing(null)}>New post</button></div>
          <UpdatesError message={posts.error} retry={posts.reload} />
          {posts.loading && <p role="status">Loading posts...</p>}
          {posts.data && <>{!posts.data.items.length && <p className="muted-copy">Create your first update.</p>}
            <ul>{posts.data.items.map(post => <li key={post.id}><div><strong>{post.title}</strong><div className="updates-post-meta"><span>{post.status}</span><PostDate date={post.publishedAt} /></div></div>
              <button className="secondary-button" onClick={() => setEditing(post)}>Edit</button></li>)}</ul>
            <UpdatesPagination page={page} hasNextPage={posts.data.hasNextPage} onChange={setPage} />
          </>}
        </section>}
    </div>
  </div>;
}

export function AdminPage({ token, onLogin }: { token: string | null; onLogin: () => void }) {
  const access = useUpdatesResource<{ isAdmin: boolean }>(token ? '/api/admin/access' : null, token);
  return <main className="page updates-page admin-page"><header className="glass-card updates-hero"><p className="eyebrow">Characterdle</p><h1>Administration</h1></header>
    {!token ? <section className="glass-card updates-empty"><p>Sign in with your administrator account.</p><button className="primary-button" onClick={onLogin}>Sign in</button></section>
      : <>{access.loading && <p role="status">Checking access...</p>}<UpdatesError message={access.error} retry={access.reload} />
        {access.data?.isAdmin && <AdminWorkspace token={token} />}</>}
  </main>;
}
