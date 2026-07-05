import { authClient } from "./auth-client";
import { publicApiFetch } from "./apiFetch";

type SendCodeResponse = { ok?: boolean; retryAfterSec?: number };
type VerifyCodeResponse = { ok?: boolean; verificationToken?: string };

export async function sendSignupVerificationCode(input: {
  email: string;
  name?: string;
}): Promise<{ ok: true } | { ok: false; message: string; retryAfterSec?: number }> {
  const res = await publicApiFetch<SendCodeResponse>("/signup/send-code", {
    method: "POST",
    body: { email: input.email.trim(), name: input.name?.trim() || undefined },
  });

  if (!res.ok) {
    return {
      ok: false,
      message: res.message,
      retryAfterSec: res.error.retryAfterSec,
    };
  }

  return { ok: true };
}

export async function verifySignupVerificationCode(input: {
  email: string;
  code: string;
}): Promise<{ ok: true; verificationToken: string } | { ok: false; message: string }> {
  const res = await publicApiFetch<VerifyCodeResponse>("/signup/verify-code", {
    method: "POST",
    body: { email: input.email.trim(), code: input.code.trim() },
  });

  if (!res.ok || typeof res.data?.verificationToken !== "string") {
    return {
      ok: false,
      message: res.ok ? "Could not verify your code. Try again." : res.message,
    };
  }

  return { ok: true, verificationToken: res.data.verificationToken };
}

export async function registerVerifiedSignup(input: {
  name: string;
  email: string;
  password: string;
  verificationToken: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await publicApiFetch<Record<string, unknown>>("/signup/register", {
    method: "POST",
    body: {
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
      verificationToken: input.verificationToken,
    },
  });

  if (!res.ok) {
    return { ok: false, message: res.message };
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
