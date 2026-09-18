import { useId } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { previewPostImageUrl, safePostUrl } from '../../lib/postMarkdown';

export function PostBody({ body, localImages }: { body: string; localImages?: ReadonlyMap<string, string> }) {
  const footnotePrefix = `post-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-`;
  return <div className="post-body"><Markdown skipHtml remarkPlugins={[remarkGfm]}
    remarkRehypeOptions={{ clobberPrefix: footnotePrefix }}
    urlTransform={(url, key) => key === 'src' ? previewPostImageUrl(url, localImages) : safePostUrl(url)}
    allowedElements={['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote', 'a', 'code', 'pre', 'hr', 'br',
      'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del', 'input', 'section', 'sup']}
    components={{
      a: ({ href, children, id, title, className, 'aria-label': label, 'aria-describedby': describedBy }) => href
        ? <a href={href} id={id} title={title} className={className} aria-label={label}
          aria-describedby={describedBy === 'footnote-label' ? `${footnotePrefix}label` : describedBy} rel="noopener noreferrer"
          onClick={event => {
            if (!href.startsWith(`#${footnotePrefix}`)) return;
            const target = document.getElementById(href.slice(1));
            if (!target) return;
            // Footnotes stay inside the post without triggering the application's route/popstate guards.
            event.preventDefault(); target.tabIndex = -1;
            target.scrollIntoView({ block: 'nearest' }); target.focus({ preventScroll: true });
          }}>{children}</a>
        : <span>{children}</span>,
      h2: ({ id, className, children }) => <h2 id={id === 'footnote-label' ? `${footnotePrefix}label` : id} className={className}>{children}</h2>,
      img: ({ src, alt, title }) => src ? <img src={src} alt={alt ?? ''} title={title} loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span>{alt}</span>,
      input: ({ checked }) => <input type="checkbox" checked={!!checked} disabled readOnly aria-label={checked ? 'Completed task' : 'Incomplete task'} />,
      table: ({ children }) => <div className="post-table-scroll" role="region" aria-label="Table" tabIndex={0}><table>{children}</table></div>,
    }}
  >{body}</Markdown></div>;
}
