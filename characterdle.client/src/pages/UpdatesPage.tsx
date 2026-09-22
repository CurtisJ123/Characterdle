import { useEffect, useState } from 'react';
import { useUpdatesResource } from '../hooks/useUpdatesResource';
import type { Announcement, AnnouncementPage } from '../types/announcements';
import { UpdateArticle, UpdatesHeading, UpdatesList } from '../components/updates/UpdateContent';
import { PostComments } from '../components/updates/PostComments';
import { UpdatesError, UpdatesPagination } from '../components/updates/UpdatesCommon';
import { markAnnouncementRead } from '../lib/announcementState';
import { applyPageSeo } from '../lib/pageSeo';
import { resolveAnnouncementSeo } from '../seo/metadata';
import { readPublicUpdates } from '../seo/publicUpdates';
import './UpdatesPage.css';

export function UpdatesPage({ slug, token, userId, onLogin }: {
  slug?: string; token: string | null; userId?: string; onLogin: () => void;
}) {
  const [page, setPage] = useState(1);
  const initial = readPublicUpdates(slug ? `/updates/${encodeURIComponent(slug)}` : '/updates');
  const list = useUpdatesResource<AnnouncementPage<Announcement>>(slug ? null : `/api/updates?page=${page}`, null, initial?.list);
  const detail = useUpdatesResource<Announcement>(slug ? `/api/updates/by-slug/${encodeURIComponent(slug)}` : null, null, initial?.post);
  const post = detail.data;
  useEffect(() => {
    if (!post) return;
    applyPageSeo(resolveAnnouncementSeo(post));
    void markAnnouncementRead(post.id, token, userId);
  }, [post, token, userId]);
  useEffect(() => {
    if (detail.error) applyPageSeo({ title: 'Update unavailable | Characterdle', description: 'This update is not available.',
      canonicalUrl: `https://characterdle.com/updates/${slug}`, robots: 'noindex,nofollow', structuredData: null });
  }, [detail.error, slug]);
  return <main className="page updates-page">
    {slug ? <>
      <a className="updates-back" href="/updates">All updates</a>
      <UpdatesError message={detail.error} retry={detail.reload} />
      {detail.loading && <p role="status">Loading update...</p>}
      {post && <><UpdateArticle post={post} />
        <PostComments key={`${post.id}:${userId ?? 'guest'}`} postId={post.id} token={token} onLogin={onLogin} /></>}
    </> : <>
      <UpdatesHeading />
      <UpdatesError message={list.error} retry={list.reload} />
      {list.loading && <p role="status">Loading updates...</p>}
      {list.data && <>
        {!list.data.items.length && <p className="glass-card updates-empty">Updates are on their way. Check back soon.</p>}
        <UpdatesList items={list.data.items} />
        <UpdatesPagination page={page} hasNextPage={list.data.hasNextPage} onChange={setPage} />
      </>}
    </>}
  </main>;
}
