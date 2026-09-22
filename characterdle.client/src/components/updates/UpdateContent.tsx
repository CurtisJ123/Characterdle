import type { Announcement } from '../../types/announcements';
import { PostBody } from './PostBody';
import { PostDate } from './UpdatesCommon';

export function UpdateArticle({ post }: { post: Announcement }) {
  return <article className="glass-card updates-article">
    <p className="eyebrow">News &amp; Updates</p>
    <PostDate date={post.publishedAt} /><h1>{post.title}</h1>
    <PostBody body={post.bodyMarkdown} />
  </article>;
}

export function UpdatesHeading() {
  return <header className="glass-card updates-hero"><p className="eyebrow">From Characterdle</p>
    <h1>News &amp; Updates</h1><p>New features, improvements, and announcements.</p></header>;
}

export function UpdatesList({ items }: { items: Announcement[] }) {
  return <div className="updates-list">{items.map(item => <article className="glass-card updates-card" key={item.id}>
    <PostDate date={item.publishedAt} /><h2><a href={`/updates/${encodeURIComponent(item.slug)}`}>{item.title}</a></h2>
    <p>{item.summary}</p><a className="updates-read-link" href={`/updates/${encodeURIComponent(item.slug)}`}>Read update <span aria-hidden="true">&rarr;</span></a>
  </article>)}</div>;
}
