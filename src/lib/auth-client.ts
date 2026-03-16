import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { DOMAIN } from "../../constants";

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
