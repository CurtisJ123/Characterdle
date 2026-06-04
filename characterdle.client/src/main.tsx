import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { getBuildTimePublicConfig, type CharacterdlePublicConfig } from './lib/runtimeConfig';

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

async function bootstrap() {
  window.__CHARACTERDLE_PUBLIC_CONFIG__ = await resolveRuntimeConfig();

  const [{ default: App }, { AuthProvider }, { UniverseProvider }] = await Promise.all([
    import('./App.tsx'),
    import('./contexts/AuthContext'),
    import('./contexts/UniverseContext'),
  ]);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <UniverseProvider>
          <App />
        </UniverseProvider>
      </AuthProvider>
    </StrictMode>,
  );
}

void bootstrap().catch((error) => {
  console.error(error);

  const root = document.getElementById('root');

  if (!root) {
    return;
  }

  root.innerHTML = `
    <div style="padding:24px;color:#f6edff;background:#140f18;font:600 16px/1.5 system-ui,sans-serif;">
      Unable to load Characterdle right now.
    </div>
  `;
});
