/**
 * Per-app database configuration store.
 *
 * Each chat/app can independently use:
 *   - 'internal': an isolated Postgres schema on the bolt.feldev instance
 *     (schema name = `app_<first8ofChatId>`, created on demand)
 *   - 'supabase': an external Supabase project
 *
 * Config is persisted to localStorage keyed by chatId.
 */
import { atom } from 'nanostores';

export type DbProvider = 'internal' | 'supabase';

export interface AppDbConfig {
  provider: DbProvider;
  /** Internal schema name — always `app_<chatId_first8>` */
  schema?: string;
  /** Supabase project ID if provider === 'supabase' */
  supabaseProjectId?: string;
}

const STORAGE_PREFIX = 'bolt_appdb_';

function storageKey(chatId: string) {
  return `${STORAGE_PREFIX}${chatId}`;
}

export function loadAppDbConfig(chatId: string): AppDbConfig {
  if (typeof localStorage === 'undefined') return defaultConfig(chatId);
  try {
    const raw = localStorage.getItem(storageKey(chatId));
    return raw ? JSON.parse(raw) : defaultConfig(chatId);
  } catch {
    return defaultConfig(chatId);
  }
}

export function saveAppDbConfig(chatId: string, config: AppDbConfig) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(storageKey(chatId), JSON.stringify(config));
}

function defaultConfig(chatId: string): AppDbConfig {
  return {
    provider: 'internal',
    schema: schemaFor(chatId),
  };
}

/** Derives a safe Postgres schema name from a chatId */
export function schemaFor(chatId: string): string {
  // Use first 12 chars, lowercased, alphanumeric only
  const safe = chatId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12);
  return `app_${safe || 'default'}`;
}

/** Reactive atom for the *active* app's DB config. Updated when chat changes. */
export const activeAppDb = atom<AppDbConfig & { chatId: string }>({
  chatId: '',
  provider: 'internal',
  schema: 'public',
});

export function setActiveApp(chatId: string) {
  const config = loadAppDbConfig(chatId);
  activeAppDb.set({ ...config, chatId, schema: config.schema ?? schemaFor(chatId) });
}

export function updateActiveAppDb(patch: Partial<AppDbConfig>) {
  const current = activeAppDb.get();
  const updated = { ...current, ...patch };
  activeAppDb.set(updated);
  if (current.chatId) {
    saveAppDbConfig(current.chatId, updated);
  }
}
