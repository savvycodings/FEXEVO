import { authClient } from "./auth-client";

type ApiErrorBody = {
  error?: string;
  message?: string;
  retryAfterSec?: number;
  verificationToken?: string;
};

function unwrapFetchResult(res: unknown): {
  ok: boolean;
  body: ApiErrorBody & Record<string, unknown>;
  status?: number;
} {
  if (res == null) {
    return { ok: false, body: { message: "Network error. Check your connection and try again." } };
  }

  const payload = res as { data?: unknown; error?: ApiErrorBody & { status?: number }; status?: number };
  if (payload.error) {
    return {
      ok: false,
      body: payload.error,
      status: payload.error.status ?? payload.status,
    };
  }

  const body = (payload.data ?? payload) as ApiErrorBody & Record<string, unknown>;
  if (body.error && !body.verificationToken) {
    return { ok: false, body, status: payload.status };
  }

  return { ok: true, body, status: payload.status };
}

export async function sendSignupVerificationCode(input: {
  email: string;
  name?: string;
}): Promise<{ ok: true } | { ok: false; message: string; retryAfterSec?: number }> {
  const res = await authClient
    .$fetch("/signup/send-code", {
      method: "POST",
      body: { email: input.email.trim(), name: input.name?.trim() || undefined },
    })
    .catch((err: { error?: ApiErrorBody; message?: string }) => {
      return { error: err?.error ?? { message: err?.message || "Could not send verification code." } };
    });

  const parsed = unwrapFetchResult(res);
  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.body.message || "Could not send verification code.",
      retryAfterSec: parsed.body.retryAfterSec,
    };
  }

  return { ok: true };
}

export async function verifySignupVerificationCode(input: {
  email: string;
  code: string;
}): Promise<{ ok: true; verificationToken: string } | { ok: false; message: string }> {
  const res = await authClient
    .$fetch("/signup/verify-code", {
      method: "POST",
      body: { email: input.email.trim(), code: input.code.trim() },
    })
    .catch((err: { error?: ApiErrorBody; message?: string }) => {
      return { error: err?.error ?? { message: err?.message || "Could not verify code." } };
    });

  const parsed = unwrapFetchResult(res);
  if (!parsed.ok || typeof parsed.body.verificationToken !== "string") {
    return {
      ok: false,
      message: parsed.body.message || "That code is incorrect. Try again.",
    };
  }

  return { ok: true, verificationToken: parsed.body.verificationToken };
}

export async function registerVerifiedSignup(input: {
  name: string;
  email: string;
  password: string;
  verificationToken: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await authClient
    .$fetch("/signup/register", {
      method: "POST",
      body: {
        name: input.name.trim(),
        email: input.email.trim(),
        password: input.password,
        verificationToken: input.verificationToken,
      },
    })
    .catch((err: { error?: ApiErrorBody; message?: string }) => {
      return { error: err?.error ?? { message: err?.message || "Could not create account." } };
    });

  const parsed = unwrapFetchResult(res);
  if (!parsed.ok) {
    return { ok: false, message: parsed.body.message || "Could not create your account." };
  }

  const signInRes = await authClient.signIn.email({
    email: input.email.trim(),
    password: input.password,
  });

  if (signInRes?.error) {
    return { ok: false, message: signInRes.error.message || "Account created but sign-in failed." };
  }

  return { ok: true };
}
