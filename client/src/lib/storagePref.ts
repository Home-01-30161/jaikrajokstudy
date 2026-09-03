// storagePref.ts — User storage preference utility
// Persists the user's choice of "local" (localStorage only) or "cloud" (Supabase).

const PREF_KEY = "jaikrajok:storage_pref";

export type StoragePref = "local" | "cloud";

/** Returns the saved preference, or null if no choice has been made yet. */
export function getStoragePref(): StoragePref | null {
  try {
    const val = localStorage.getItem(PREF_KEY);
    if (val === "local" || val === "cloud") return val;
  } catch {
    /* localStorage unavailable */
  }
  return null;
}

/** Saves the user's storage preference. */
export function setStoragePref(pref: StoragePref): void {
  try {
    localStorage.setItem(PREF_KEY, pref);
  } catch {
    /* ignore */
  }
}

/** Clears the saved preference (used on logout if desired). */
export function clearStoragePref(): void {
  try {
    localStorage.removeItem(PREF_KEY);
  } catch {
    /* ignore */
  }
}
