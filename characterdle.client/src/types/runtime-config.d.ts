export {};

declare global {
  interface Window {
    __CHARACTERDLE_PUBLIC_CONFIG__?: {
      supabasePublishableKey: string;
      supabaseUrl: string;
    };
  }
}
