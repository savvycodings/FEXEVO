import { DOMAIN } from "../../constants";
import { formatApiError } from "./formatApiError";

export type PublicApiError = {
  error?: string;
  message?: string;
  retryAfterSec?: number;
};

export type PublicApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: PublicApiError; message: string };

function apiRoot(): string {
  return (DOMAIN || "").replace(/\/+$/, "");
}

function withNgrokHeaders(headers: Record<string, string>, url: string): Record<string, string> {
  if (/ngrok-free\.(dev|app)/i.test(url)) {
    return { ...headers, "ngrok-skip-browser-warning": "69420" };
  }
  return headers;
}

function networkMessage(status: number, rawText: string): string {
  if (status === 404) {
    return "Signup API not found. Restart the server and make sure app .env EXPO_PUBLIC_BACKEND_URL matches your active ngrok tunnel.";
  }
  if (status === 0) {
    return "Could not reach the server. Check your connection and that EXPO_PUBLIC_BACKEND_URL matches your ngrok tunnel.";
  }
  if (rawText.trim().startsWith("<!DOCTYPE") || rawText.trim().startsWith("<html")) {
    return "Received an HTML page instead of JSON (often an ngrok warning). Update EXPO_PUBLIC_BACKEND_URL to your active ngrok URL.";
  }
  if (status >= 500) {
    return "Server error while sending the code. Check server logs for [SignupVerification].";
  }
  return `Request failed (${status}).`;
}

/** Unauthenticated JSON calls against the API root (not /api/auth). */
export async function publicApiFetch<T>(
  path: string,
  init: { method?: string; body?: Record<string, unknown> } = {}
): Promise<PublicApiResult<T>> {
  const url = `${apiRoot()}${path.startsWith("/") ? path : `/${path}`}`;
  const method = init.method ?? "GET";
  const headers = withNgrokHeaders(
    { "Content-Type": "application/json", Accept: "application/json" },
    url
  );

  if (__DEV__) {
    console.log("[ApiFetch] →", method, url, init.body ?? null);
  }

  let res: Response;
  let rawText = "";
  try {
    res = await fetch(url, {
      method,
      headers,
      body: init.body != null ? JSON.stringify(init.body) : undefined,
    });
    rawText = await res.text();
  } catch (err) {
    const message = formatApiError(err, networkMessage(0, ""));
    if (__DEV__) console.error("[ApiFetch] network error", url, err);
    return { ok: false, status: 0, error: { message }, message };
  }

  let parsed: (T & PublicApiError) | null = null;
  try {
    parsed = rawText ? (JSON.parse(rawText) as T & PublicApiError) : null;
  } catch {
    const message = networkMessage(res.status, rawText);
    if (__DEV__) {
      console.error("[ApiFetch] non-JSON", url, res.status, rawText.slice(0, 240));
    }
    return { ok: false, status: res.status, error: { message }, message };
  }

  if (__DEV__) {
    console.log("[ApiFetch] ←", url, res.status, parsed);
  }

  if (!res.ok) {
    const message =
      (typeof parsed?.message === "string" && parsed.message.trim()) ||
      networkMessage(res.status, rawText);
    return {
      ok: false,
      status: res.status,
      error: parsed ?? { message },
      message,
    };
  }

  return { ok: true, status: res.status, data: parsed as T };
}
