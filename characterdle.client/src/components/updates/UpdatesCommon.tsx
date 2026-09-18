export function UpdatesPagination({ page, hasNextPage, onChange, disabled = false }: {
  page: number; hasNextPage: boolean; onChange: (page: number) => void; disabled?: boolean;
}) {
  if (page === 1 && !hasNextPage) return null;
  return <nav className="updates-pagination" aria-label="Pages">
    <button className="secondary-button" disabled={disabled || page === 1} onClick={() => onChange(page - 1)}>Previous</button>
    <span>Page {page}</span>
    <button className="secondary-button" disabled={disabled || !hasNextPage} onClick={() => onChange(page + 1)}>Next</button>
  </nav>;
}

export function UpdatesError({ message, retry }: { message?: string; retry?: () => void }) {
  return message ? <div className="updates-error" role="alert"><p>{message}</p>
    {retry && <button className="secondary-button" onClick={retry}>Try again</button>}</div> : null;
}

export function PostDate({ date }: { date: string | null }) {
  return date ? <time dateTime={date}>{new Date(date).toLocaleDateString(undefined, { dateStyle: 'long' })}</time> : <span>Draft</span>;
}
