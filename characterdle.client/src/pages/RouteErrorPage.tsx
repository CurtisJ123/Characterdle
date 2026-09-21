export function RouteErrorPage({ status = 404 }: { status?: 404 | 503 }) {
  return <main className="page informational-page">
    <section className="glass-card informational-hero">
      <div className="informational-hero-copy">
        <h1>{status === 404 ? 'Page not found' : 'Game temporarily unavailable'}</h1>
        <p>{status === 404 ? 'This page could not be found.' : 'Please try again shortly.'}</p>
      </div>
      <nav className="informational-hero-actions" aria-label="Page recovery">
        {status === 503 && <a className="primary-button" href="">Try again</a>}
        <a className="secondary-button" href="/home">Back to Characterdle</a>
      </nav>
    </section>
  </main>;
}
