/** Server address from the environment, so local and VPS URLs switch without code changes. */
export const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'ws://localhost:2567';

/** The same server's HTTP address (for /health), derived from the ws(s):// URL. */
export const SERVER_HTTP_URL: string = SERVER_URL.replace(/^ws/, 'http');
