import { authClient } from "./auth-client";

type AuthCallError = {
  message?: string;
  code?: string;
  status?: number;
};

function callError(error: unknown): AuthCallError | null {
  if (!error || typeof error !== "object") return null;
  const record = error as AuthCallError;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
  };
}

export function passwordResetErrorKey(error: AuthCallError | null): string | null {
  switch (error?.code) {
    case "INVALID_OTP":
      return "auth.codeIncorrect";
    case "OTP_EXPIRED":
      return "auth.codeExpired";
    case "TOO_MANY_ATTEMPTS":
      return "auth.tooManyAttempts";
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return "auth.passwordMin8";
    default:
      return error?.status === 429 ? "auth.tooManyAttempts" : null;
  }
}

export async function requestPasswordResetCode(
  email: string
): Promise<{ ok: true } | { ok: false; messageKey: string | null; message?: string }> {
  const { error } = await authClient.emailOtp.requestPasswordReset({
    email: email.trim().toLowerCase(),
  });
  if (error) {
    const parsed = callError(error);
    return {
      ok: false,
      messageKey: passwordResetErrorKey(parsed),
      message: parsed?.message,
    };
  }
  return { ok: true };
}

export async function resetPasswordWithCode(input: {
  email: string;
  otp: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; messageKey: string | null; message?: string }> {
  const { error } = await authClient.emailOtp.resetPassword({
    email: input.email.trim().toLowerCase(),
    otp: input.otp.trim(),
    password: input.password,
  });
  if (error) {
    const parsed = callError(error);
    return {
      ok: false,
      messageKey: passwordResetErrorKey(parsed),
      message: parsed?.message,
    };
  }
  return { ok: true };
}
