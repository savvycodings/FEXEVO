import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { DOMAIN } from "../../constants";

/**
 * Web build of the auth client (Metro picks this file over auth-client.ts on web).
 * Browsers keep the better-auth session cookie themselves, so there's no expoClient /
 * SecureStore here; every request just sends credentials. The API must list the web origin
 * in better-auth's trustedOrigins (localhost:8081 already is).
 */
function applyNgrokHeaders(url: string, headers: Headers) {
  if (/ngrok-free\.(dev|app)/i.test(url)) {
    headers.set("ngrok-skip-browser-warning", "69420");
  }
}

export const authClient = createAuthClient({
  baseURL: DOMAIN,
  fetchOptions: {
    credentials: "include",
    onRequest: (context) => {
      const url = typeof context.url === "string" ? context.url : context.url?.toString?.() ?? "";
      applyNgrokHeaders(url, context.headers);
    },
  },
  plugins: [emailOTPClient()],
});
