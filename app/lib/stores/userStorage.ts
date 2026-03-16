let currentUserId: string | null = null;

export function setCurrentUser(userId: string | null) {
  currentUserId = userId;
}

export function getUserStorageKey(key: string): string {
  if (currentUserId) {
    return `user_${currentUserId}_${key}`;
  }
  return key;
}

export const userStorage = {
  getItem(key: string): string | null {
    return localStorage.getItem(getUserStorageKey(key));
  },
  setItem(key: string, value: string): void {
    localStorage.setItem(getUserStorageKey(key), value);
  },
  removeItem(key: string): void {
    localStorage.removeItem(getUserStorageKey(key));
  },
};
