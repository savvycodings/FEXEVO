import { Image } from "react-native";
import { LocalSvgAsset } from "./LocalSvgAsset";

type ClubPfpImageProps = {
  pfpMod: number;
  /** When set (e.g. i95 `paddlepfp.png`), use raster instead of SVG. */
  pfpPng?: number;
  size: number;
};

export function ClubPfpImage({ pfpMod, pfpPng, size }: ClubPfpImageProps) {
  const radius = size / 2;
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
  return <LocalSvgAsset assetModule={pfpMod} width={size} height={size} />;
}
