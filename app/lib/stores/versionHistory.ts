import { atom, map } from 'nanostores';

const VERSION_HISTORY_KEY = 'bolt_versions';
const MAX_CHECKPOINTS = 10;

export interface VersionCheckpoint {
  id: string;
  timestamp: number;
  label: string;
  files: Record<string, string>;
  fileCount: number;
}

function loadCheckpoints(): VersionCheckpoint[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(VERSION_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCheckpoints(checkpoints: VersionCheckpoint[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(checkpoints));
  } catch {
    // ignore storage errors (e.g. quota exceeded)
  }
}

export const versionCheckpoints = atom<VersionCheckpoint[]>(
  typeof window !== 'undefined' ? loadCheckpoints() : [],
);

export function createCheckpoint(files: Record<string, string>, label?: string) {
  const existing = versionCheckpoints.get();
  const fileCount = Object.keys(files).length;

  if (fileCount === 0) return;

  const id = `v${Date.now()}`;
  const timestamp = Date.now();
  const versionNum = existing.length + 1;
  const checkpointLabel = label || `v${versionNum}`;

  const checkpoint: VersionCheckpoint = {
    id,
    timestamp,
    label: checkpointLabel,
    files: { ...files },
    fileCount,
  };

  const updated = [checkpoint, ...existing].slice(0, MAX_CHECKPOINTS);
  versionCheckpoints.set(updated);
  saveCheckpoints(updated);
}

export function clearCheckpoints() {
  versionCheckpoints.set([]);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(VERSION_HISTORY_KEY);
  }
}
