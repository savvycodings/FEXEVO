import { authClient } from "./auth-client";

export type SocialProvider = "google" | "facebook" | "apple";

/** Order of buttons when multiple providers are enabled */
export const SOCIAL_PROVIDERS_ORDER: SocialProvider[] = [
  "google",
  "facebook",
  "apple",
];

/**
 * Comma-separated list in EXPO_PUBLIC_SOCIAL_PROVIDERS (e.g. `facebook` or `google,facebook`).
 * Must match what the API enables: each provider needs CLIENT_ID + CLIENT_SECRET in server env.
 * If unset, all three buttons are shown (legacy default).
 */
export function getEnabledSocialProviders(): SocialProvider[] {
  const raw = process.env.EXPO_PUBLIC_SOCIAL_PROVIDERS?.trim();
  if (!raw) {
    return [...SOCIAL_PROVIDERS_ORDER];
  }
  const allow = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  const picked = SOCIAL_PROVIDERS_ORDER.filter((p) => allow.has(p));
  return picked.length > 0 ? picked : [...SOCIAL_PROVIDERS_ORDER];
}

export function formatSocialAuthError(error: {
  message?: string;
  code?: string;
}): string {
  const code = error.code ?? "";
  const msg = error.message ?? "";
  if (
    code === "oauth_provider_not_found" ||
    /provider not found/i.test(msg)
  ) {
    return "This sign-in method is not enabled on the server. Add that provider’s client ID and secret to the API environment (or set EXPO_PUBLIC_SOCIAL_PROVIDERS to only the providers you configured).";
  }
  return msg || "Could not sign in with this provider.";
}

export async function signInWithSocial(provider: SocialProvider) {
  return authClient.signIn.social({
    provider,
    callbackURL: "/",
  });
}
