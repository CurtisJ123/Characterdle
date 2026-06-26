import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './index.css';
import { getBuildTimePublicConfig, type CharacterdlePublicConfig } from './lib/runtimeConfig';
import { getUniverseHostRedirectUrl } from './lib/siteRouting';

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
      <main className="startup-screen">
        <section className="startup-screen__card">
          <img
            src="/brand/characterdle-logo.png"
            alt=""
            aria-hidden="true"
            className="startup-screen__logo"
          />
          <p className="startup-screen__kicker">Characterdle</p>
          <h1 className="startup-screen__title">{title}</h1>
          <p className="startup-screen__message">{message}</p>
          {retryAction && (
            <button
              type="button"
              onClick={retryAction}
              className="startup-screen__retry"
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
  const hostRedirectUrl = getUniverseHostRedirectUrl(
    window.location.hostname,
    window.location.pathname,
    window.location.search,
    window.location.hash,
  );

  if (hostRedirectUrl && hostRedirectUrl !== window.location.href) {
    window.location.replace(hostRedirectUrl);
    return;
  }

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
