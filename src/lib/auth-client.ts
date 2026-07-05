import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { DOMAIN } from "../../constants";

function applyNgrokHeaders(url: string, headers: Headers) {
  if (/ngrok-free\.(dev|app)/i.test(url)) {
    headers.set("ngrok-skip-browser-warning", "69420");
  }
}

console.log("[AuthClient] Init", {
  baseURL: DOMAIN,
  EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,
  EXPO_PUBLIC_BETTER_AUTH_URL: process.env.EXPO_PUBLIC_BETTER_AUTH_URL,
});

export const authClient = createAuthClient({
  baseURL: DOMAIN,
  fetchOptions: {
    onRequest: (context) => {
      const url = typeof context.url === "string" ? context.url : context.url?.toString?.() ?? "";
      applyNgrokHeaders(url, context.headers);
    },
  },
  plugins: [
    expoClient({
      scheme: "xevo",
      storagePrefix: "xevo",
      storage: SecureStore,
    }),
  ],
});
