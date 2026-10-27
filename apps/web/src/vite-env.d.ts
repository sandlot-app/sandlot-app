/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

// hls.js ships the light build without its own types. It has the same API minus features the page doesn't use.
declare module 'hls.js/light' {
  export { default } from 'hls.js';
}
