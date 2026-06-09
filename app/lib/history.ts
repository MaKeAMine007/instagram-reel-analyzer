export interface HistoryItem {
  url: string;
  thumbnail: string | null;
  username: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  timestamp: string | null;
  analyzedAt: string;
}

const HISTORY_KEY = "reel-analyzer-history";
const HISTORY_MAX = 10;

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryItem[];
  } catch {
    return [];
  }
}

export function saveToHistory(item: HistoryItem): void {
  const existing = loadHistory();
  const deduped = existing.filter((h) => h.url !== item.url);
  const updated = [item, ...deduped].slice(0, HISTORY_MAX);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}
