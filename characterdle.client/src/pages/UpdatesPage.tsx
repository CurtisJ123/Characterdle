import { useEffect, useState } from 'react';
import { useUpdatesResource } from '../hooks/useUpdatesResource';
import type { Announcement, AnnouncementPage } from '../types/announcements';
import { PostBody } from '../components/updates/PostBody';
import { PostComments } from '../components/updates/PostComments';
import { PostDate, UpdatesError, UpdatesPagination } from '../components/updates/UpdatesCommon';
import { markAnnouncementRead } from '../lib/announcementState';
import { applyPageSeo } from '../lib/pageSeo';
import './UpdatesPage.css';

export function UpdatesPage({ slug, token, userId, onLogin }: {
  slug?: string; token: string | null; userId?: string; onLogin: () => void;
}) {
  const [page, setPage] = useState(1);
  const list = useUpdatesResource<AnnouncementPage<Announcement>>(slug ? null : `/api/updates?page=${page}`);
  const detail = useUpdatesResource<Announcement>(slug ? `/api/updates/by-slug/${encodeURIComponent(slug)}` : null);
  const post = detail.data;
  useEffect(() => {
    if (!post) return;
    applyPageSeo({ title: `${post.title} | Characterdle`, description: post.summary,
      canonicalUrl: `https://characterdle.com/updates/${post.slug}`, robots: 'index,follow',
      structuredData: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
        description: post.summary, datePublished: post.publishedAt, dateModified: post.updatedAt,
        author: { '@type': 'Organization', name: 'Characterdle' } } });
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
      {post && <><article className="glass-card updates-article"><p className="eyebrow">News &amp; Updates</p>
        <PostDate date={post.publishedAt} /><h1>{post.title}</h1>
        <PostBody body={post.bodyMarkdown} /></article>
        <PostComments key={`${post.id}:${userId ?? 'guest'}`} postId={post.id} token={token} onLogin={onLogin} /></>}
    </> : <>
      <header className="glass-card updates-hero"><p className="eyebrow">From Characterdle</p><h1>News &amp; Updates</h1><p>New features, improvements, and announcements.</p></header>
      <UpdatesError message={list.error} retry={list.reload} />
      {list.loading && <p role="status">Loading updates...</p>}
      {list.data && <>
        {!list.data.items.length && <p className="glass-card updates-empty">Updates are on their way. Check back soon.</p>}
        <div className="updates-list">{list.data.items.map(item => <article className="glass-card updates-card" key={item.id}>
          <PostDate date={item.publishedAt} /><h2><a href={`/updates/${item.slug}`}>{item.title}</a></h2>
          <p>{item.summary}</p><a className="updates-read-link" href={`/updates/${item.slug}`}>Read update <span aria-hidden="true">&rarr;</span></a>
        </article>)}</div>
        <UpdatesPagination page={page} hasNextPage={list.data.hasNextPage} onChange={setPage} />
      </>}
    </>}
  </main>;
}
