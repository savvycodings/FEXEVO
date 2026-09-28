import { Image, View } from "react-native";
import { LocalSvgAsset } from "./LocalSvgAsset";

type ClubBannerImageProps = {
  /** Real club banner uploaded via the club portal — takes priority when present. */
  uri?: string | null;
  bannerMod?: number;
  /** When set (e.g. i95 `paddlebanner2.png`), use raster — avoids SVG pattern limits. */
  bannerPng?: number;
  width: number;
  height: number;
};

export function ClubBannerImage({ uri, bannerMod, bannerPng, width, height }: ClubBannerImageProps) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width, height }}
        resizeMode="cover"
        accessibilityLabel="Club banner"
      />
    );
  }
  if (bannerPng != null) {
    return (
      <Image
        source={bannerPng}
        style={{ width, height }}
        resizeMode="cover"
        accessibilityLabel="Club banner"
      />
    );
  }
  if (bannerMod != null) {
    return <LocalSvgAsset assetModule={bannerMod} width={width} height={height} />;
  }
  return <View style={{ width, height, backgroundColor: "#0E1830" }} />;
}
