import { Image } from "react-native";
import { LocalSvgAsset } from "./LocalSvgAsset";

type ClubBannerImageProps = {
  bannerMod: number;
  /** When set (e.g. i95 `paddlebanner2.png`), use raster — avoids SVG pattern limits. */
  bannerPng?: number;
  width: number;
  height: number;
};

export function ClubBannerImage({ bannerMod, bannerPng, width, height }: ClubBannerImageProps) {
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
  return <LocalSvgAsset assetModule={bannerMod} width={width} height={height} />;
}
