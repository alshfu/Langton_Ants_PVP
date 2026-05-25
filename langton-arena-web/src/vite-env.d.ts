/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_REGION?: string;
  readonly VITE_DEFAULT_LOCALE?: string;
  readonly VITE_DEFAULT_THEME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
