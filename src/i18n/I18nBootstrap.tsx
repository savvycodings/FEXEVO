import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { resolveInitialLanguage, setAppLanguage } from "./language";

type Props = {
  children: ReactNode;
  backgroundColor?: string;
};

/** Applies persisted or device-detected language before showing auth/onboarding UI. */
export function I18nBootstrap({ children, backgroundColor = "#030A17" }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const lang = await resolveInitialLanguage();
      await setAppLanguage(lang);
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#00BBFF" />
      </View>
    );
  }

  return <>{children}</>;
}
