import * as SecureStore from "expo-secure-store";
import { authClient } from "./auth-client";
import { clearCachedProfile } from "./profile-cache";

const COOKIE_KEY = "xevo_cookie";
const SESSION_CACHE_KEY = "xevo_session_data";

let dismissedSessionId: string | null = null;
const listeners = new Set<() => void>();

function emitDismissedSession() {
  listeners.forEach((listener) => listener());
}

export function getDismissedSessionId(): string | null {
  return dismissedSessionId;
}

export function subscribeDismissedSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Forget a local sign-out hold after a new sign-in succeeds. */
export function clearDismissedSession(): void {
  if (dismissedSessionId === null) return;
  dismissedSessionId = null;
  emitDismissedSession();
}

function rememberDismissedSession(sessionId: string | null) {
  dismissedSessionId = sessionId ?? "*";
  emitDismissedSession();
}

function clearClientSessionAtom() {
  const atom = authClient.$store.atoms.session;
  if (!atom) return;
  const current = atom.get();
  atom.set({
    ...current,
    data: null,
    error: null,
    isPending: false,
    isRefetching: false,
  });
}

async function clearStoredSession() {
  await Promise.all([
    SecureStore.setItemAsync(COOKIE_KEY, "{}").catch(() => null),
    SecureStore.deleteItemAsync(SESSION_CACHE_KEY).catch(() => null),
  ]);
}

export async function signOutAndClearProfileCache(): Promise<void> {
  const current = authClient.$store.atoms.session?.get()?.data as
    | { session?: { id?: string | null } | null }
    | null
    | undefined;
  rememberDismissedSession(current?.session?.id ?? null);
  clearClientSessionAtom();
  await clearCachedProfile();
  try {
    await authClient.signOut();
  } catch (error) {
    console.log("[Auth] signOut request failed", error);
  }
  await clearStoredSession();
  clearClientSessionAtom();
}
