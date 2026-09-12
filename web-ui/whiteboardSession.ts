const STORAGE_KEY = "brain-last-whiteboard";
const DEFAULT_BOARD = "research-map";

export function lastWhiteboard(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY);
    return id && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id) ? id : DEFAULT_BOARD;
  } catch {
    return DEFAULT_BOARD;
  }
}

export function rememberWhiteboard(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // The board remains usable when browser storage is unavailable.
  }
}
