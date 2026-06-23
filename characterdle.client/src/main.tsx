import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './index.css';
import { getBuildTimePublicConfig, type CharacterdlePublicConfig } from './lib/runtimeConfig';

const RECOVERY_POLL_INTERVAL_MS = 3000;
const RECOVERY_MAX_ATTEMPTS = 20;

async function resolveRuntimeConfig(): Promise<CharacterdlePublicConfig> {
  if (window.__CHARACTERDLE_PUBLIC_CONFIG__) {
    return window.__CHARACTERDLE_PUBLIC_CONFIG__;
  }

  const buildTimePublicConfig = getBuildTimePublicConfig();

  if (buildTimePublicConfig) {
    return buildTimePublicConfig;
  }

  const runtimeConfigResponse = await fetch('/api/client-config', {
    cache: 'no-store',
  });

  if (!runtimeConfigResponse.ok) {
    throw new Error(`Failed to load runtime config (${runtimeConfigResponse.status}).`);
  }

  return await runtimeConfigResponse.json() as CharacterdlePublicConfig;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getStatusEndpoint(): string {
  const runtimeConfig = window.__CHARACTERDLE_PUBLIC_CONFIG__ ?? getBuildTimePublicConfig();
  const apiBaseUrl = runtimeConfig?.apiBaseUrl?.trim().replace(/\/+$/, '') ?? '';

  return apiBaseUrl
    ? `${apiBaseUrl}/api/status`
    : '/api/status';
}

async function isBackendReady(): Promise<boolean> {
  try {
    const response = await fetch(getStatusEndpoint(), {
      cache: 'no-store',
    });

    return response.ok;
  } catch {
    return false;
  }
}

function renderStartupScreen(
  root: Root,
  title: string,
  message: string,
  retryAction?: () => void,
) {
  root.render(
    <StrictMode>
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: 'linear-gradient(180deg, #140f18 0%, #1c1522 100%)',
          color: '#f6edff',
        }}
      >
        <section
          style={{
            width: 'min(520px, 100%)',
            padding: '32px',
            borderRadius: '28px',
            border: '1px solid rgba(212, 171, 255, 0.18)',
            background: 'rgba(28, 21, 34, 0.92)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
          }}
        >
          <img
            src="/brand/characterdle-logo.png"
            alt=""
            aria-hidden="true"
            style={{
              width: '64px',
              height: '64px',
              display: 'block',
              borderRadius: '20px',
              marginBottom: '16px',
              boxShadow: '0 18px 34px rgba(157, 78, 221, 0.18)',
            }}
          />
          <p
            style={{
              margin: 0,
              color: '#d8b3ff',
              fontSize: '0.78rem',
              fontWeight: 900,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            Characterdle
          </p>
          <h1
            style={{
              margin: '12px 0 0',
              fontFamily: 'var(--heading-font, system-ui)',
              fontSize: 'clamp(2rem, 6vw, 3rem)',
              lineHeight: 0.98,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: '16px 0 0',
              color: 'rgba(246, 237, 255, 0.82)',
              fontSize: '1rem',
              lineHeight: 1.6,
            }}
          >
            {message}
          </p>
          {retryAction && (
            <button
              type="button"
              onClick={retryAction}
              style={{
                marginTop: '24px',
                border: 0,
                borderRadius: '16px',
                padding: '14px 18px',
                background: '#d4abff',
                color: '#33164d',
                fontSize: '0.98rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}
        </section>
      </main>
    </StrictMode>,
  );
}

async function bootstrap(root: Root) {
  window.__CHARACTERDLE_PUBLIC_CONFIG__ = await resolveRuntimeConfig();

  const [{ default: App }, { AuthProvider }, { UniverseProvider }] = await Promise.all([
    import('./App.tsx'),
    import('./contexts/AuthContext'),
    import('./contexts/UniverseContext'),
  ]);

  root.render(
    <StrictMode>
      <AuthProvider>
        <UniverseProvider>
          <App />
        </UniverseProvider>
      </AuthProvider>
    </StrictMode>,
  );
}

async function recoverFromStartupFailure(root: Root, error: unknown) {
  let lastError = error;
  let backendWasUnavailable = false;

  for (let attempt = 1; attempt <= RECOVERY_MAX_ATTEMPTS; attempt += 1) {
    renderStartupScreen(
      root,
      'Starting Characterdle',
      'Please wait while Characterdle loads. We will retry automatically.',
    );

    const backendReady = await isBackendReady();

    if (!backendReady) {
      backendWasUnavailable = true;
      await delay(RECOVERY_POLL_INTERVAL_MS);
      continue;
    }

    if (backendWasUnavailable) {
      renderStartupScreen(
        root,
        'Characterdle is ready',
        'Reloading the page now...',
      );
      window.setTimeout(() => window.location.reload(), 600);
      return;
    }

    try {
      await bootstrap(root);
      return;
    } catch (retryError) {
      lastError = retryError;
      console.error(retryError);
      await delay(RECOVERY_POLL_INTERVAL_MS);
    }
  }

  console.error(lastError);
  renderStartupScreen(
    root,
    'Still starting up',
    'Characterdle is taking longer than expected to start. Please give it another moment, then retry.',
    () => window.location.reload(),
  );
}

async function start() {
  const container = document.getElementById('root');

  if (!container) {
    console.error('Characterdle root container was not found.');
    return;
  }

  const root = createRoot(container);
  renderStartupScreen(
    root,
    'Starting Characterdle',
    'Loading the game and checking the server. Please wait...',
  );

  try {
    await bootstrap(root);
  } catch (error) {
    console.error(error);
    await recoverFromStartupFailure(root, error);
  }
}

void start();
