const RECONNECT_STORAGE_KEY = 'mm_reconnect_token';

/** `room.reconnectionToken` from the most recent join — lets a reopened tab resume automatically (Phase 12). */
export function saveReconnectToken(token: string) {
  try {
    localStorage.setItem(RECONNECT_STORAGE_KEY, token);
  } catch {
    // Private browsing / storage disabled — reconnect just won't be offered next visit.
  }
}

export function loadReconnectToken(): string | null {
  try {
    return localStorage.getItem(RECONNECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Called once it's clear there's nothing left to resume: an intentional leave, being removed, or the room ending. */
export function clearReconnectToken() {
  try {
    localStorage.removeItem(RECONNECT_STORAGE_KEY);
  } catch {
    // Nothing to clear if storage isn't available in the first place.
  }
}
