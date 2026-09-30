import { Image, Text, View } from "react-native";
import { LocalSvgAsset } from "./LocalSvgAsset";

type ClubPfpImageProps = {
  /** Real club logo uploaded via the club portal — takes priority when present. */
  uri?: string | null;
  pfpMod?: number;
  /** When set (e.g. i95 `paddlepfp.png`), use raster instead of SVG. */
  pfpPng?: number;
  size: number;
  /** Initial shown in the placeholder circle when there's no logo/uri/local asset at all. */
  fallbackLabel?: string;
};

export function ClubPfpImage({ uri, pfpMod, pfpPng, size, fallbackLabel }: ClubPfpImageProps) {
  const radius = size / 2;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
        accessibilityLabel="Club logo"
      />
    );
  }
  if (pfpPng != null) {
    return (
      <Image
        source={pfpPng}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
        accessibilityLabel="Club logo"
      />
    );
  }
  if (pfpMod != null) {
    return <LocalSvgAsset assetModule={pfpMod} width={size} height={size} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: "#0E1830",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: size * 0.4 }}>
        {(fallbackLabel ?? "?").slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}
