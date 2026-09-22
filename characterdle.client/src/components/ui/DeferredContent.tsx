import { Component, Suspense, type ReactNode } from 'react';

class ChunkErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <section className="page" role="alert">
        <p>This part of Characterdle could not load. Please reload to try again.</p>
        <button type="button" className="secondary-button" onClick={() => window.location.reload()}>Reload</button>
      </section>;
    }
    return this.props.children;
  }
}

export function DeferredContent({ children, resetKey }: { children: ReactNode; resetKey?: string }) {
  return <ChunkErrorBoundary key={resetKey}>
    <Suspense fallback={null}>
      {children}
    </Suspense>
  </ChunkErrorBoundary>;
}
