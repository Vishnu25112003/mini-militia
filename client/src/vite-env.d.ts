/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ws:// or wss:// address of the Colyseus server. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
