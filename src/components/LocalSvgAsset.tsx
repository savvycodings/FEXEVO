import { useEffect, useState } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { Asset } from "expo-asset";
import * as FileSystemLegacy from "expo-file-system/legacy";

type LocalSvgAssetProps = {
  /** Metro `require('./file.svg')` module id */
  assetModule: number;
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Renders a bunsdled SVG reliably on native + web. `SvgUri` + `Asset.fromModule().uri`
 * often shows nothing for larger / pattern-based SVGs; we load bytes and use `SvgXml`.
 */
export function LocalSvgAsset({ assetModule, width, height, style }: LocalSvgAssetProps) {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(assetModule);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        if (!uri || cancelled) return;
        let text: string;
        if (Platform.OS === "web") {
          const res = await fetch(uri);
          if (!res.ok) return;
          text = await res.text();
        } else {
          text = await FileSystemLegacy.readAsStringAsync(uri);
        }
        if (!cancelled) setXml(text);
      } catch {
        if (!cancelled) setXml(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetModule]);

  const boxStyle = [{ width, height }, style];
  /** Android can flatten “leaf” views without a bitmap; SvgXml then disappears while layout stays tappable. */
  const noCollapse =
    Platform.OS === "android" ? ({ collapsable: false } as const) : {};

  if (!xml) {
    return <View style={boxStyle} {...noCollapse} />;
  }
  return (
    <View style={boxStyle} {...noCollapse}>
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}
