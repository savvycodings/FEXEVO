import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { DOMAIN } from "../../constants";

console.log("[AuthClient] Init", {
  baseURL: DOMAIN,
  EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,
  EXPO_PUBLIC_BETTER_AUTH_URL: process.env.EXPO_PUBLIC_BETTER_AUTH_URL,
});

export const authClient = createAuthClient({
  baseURL: DOMAIN,
  plugins: [
    expoClient({
      scheme: "xevo",
      storagePrefix: "xevo",
      storage: SecureStore,
    }),
  ],
});
