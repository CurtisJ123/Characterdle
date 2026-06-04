export {};

declare global {
  interface Window {
    __CHARACTERDLE_PUBLIC_CONFIG__?: {
      apiBaseUrl?: string;
      supabasePublishableKey: string;
      supabaseUrl: string;
    };
  }
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
