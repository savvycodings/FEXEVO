import type { ClubId } from "../navigation/types";

/**
 * i95 Padel: banner `youpage/paddlebanner2.png`, pfp `clubs/paddlepfp.png`
 * Reserve Padel: `clubs/reservedbanner1.png`, `clubs/reservedpfp1.png` (+ SVG fallbacks)
 */
const CLUB_ASSETS: Record<
  ClubId,
  {
    bannerMod: number;
    /** Optional PNG banner (used instead of SVG when set). */
    bannerPng?: number;
    pfpMod: number;
    /** Optional PNG avatar (used instead of SVG when set). */
    pfpPng?: number;
    /** Invite list card banner corners; detail screen uses square banners. */
    bannerCornerRadius?: number;
    /** When false, detail hero skips the white ring (e.g. Reserve glow asset). */
    pfpUseWhiteRing?: boolean;
    title: string;
    subtitle: string;
  }
> = {
  i95: {
    bannerMod: require("../../assets/clubs/padlebanner.svg"),
    bannerPng: require("../../assets/youpage/paddlebanner2.png"),
    pfpMod: require("../../assets/clubs/paddlepfp.svg"),
    pfpPng: require("../../assets/clubs/paddlepfp.png"),
    title: "i95 Padel Club",
    subtitle: "Club deportivo en Miami, Florida",
  },
  reserve: {
    bannerMod: require("../../assets/clubs/reservebanner.svg"),
    bannerPng: require("../../assets/clubs/reservedbanner1.png"),
    pfpMod: require("../../assets/clubs/reservepfp.svg"),
    pfpPng: require("../../assets/clubs/reservedpfp1.png"),
    bannerCornerRadius: 0,
    pfpUseWhiteRing: false,
    title: "Reserve Padel",
    subtitle: "Club deportivo en Miami, Florida",
  },
};

/** List order: first row = i95, second = Reserve (matches tap → detail). */
const CLUB_LIST_ORDER: readonly ClubId[] = ["i95", "reserve"];

export type ClubListRow = {
  id: ClubId;
  bannerMod: number;
  bannerPng?: number;
  pfpMod: number;
  pfpPng?: number;
  bannerCornerRadius?: number;
  pfpUseWhiteRing?: boolean;
  title: string;
  subtitle: string;
};

export const CLUB_LIST_ROWS: ClubListRow[] = CLUB_LIST_ORDER.map((id) => ({
  id,
  ...CLUB_ASSETS[id],
}));

export type ClubDetailModel = ClubListRow & {
  address: string;
  phone: string;
  hours: string;
  aboutBody: string;
};

const CLUB_EXTRA: Record<
  ClubId,
  Pick<ClubDetailModel, "address" | "phone" | "hours" | "aboutBody">
> = {
  i95: {
    address: "650 NW 105th St, Miami, FL 33150, Estados Unidos",
    phone: "+1 786-642-7667",
    hours: "Abierto · Cierra a las 11 p.m.",
    aboutBody:
      "i95 Padel Club ofrece canchas de pádel de primer nivel en Miami, con instalaciones interiores y exteriores, iluminación profesional y ambiente pensado para jugadores de todos los niveles.",
  },
  reserve: {
    address: "8900 NW 27th Ave, Miami, FL 33147, Estados Unidos",
    phone: "+1 305-555-0198",
    hours: "Abierto · Cierra a las 10 p.m.",
    aboutBody:
      "Reserve Padel combina canchas al aire libre y zona social para disfrutar del pádel en Miami, con reservas flexibles y eventos para la comunidad.",
  },
};

export function getClubDetail(id: string): ClubDetailModel | null {
  const key = id.trim() as ClubId;
  if (key !== "i95" && key !== "reserve") return null;
  const base = CLUB_ASSETS[key];
  return {
    id: key,
    bannerMod: base.bannerMod,
    bannerPng: base.bannerPng,
    pfpMod: base.pfpMod,
    pfpPng: base.pfpPng,
    bannerCornerRadius: base.bannerCornerRadius,
    pfpUseWhiteRing: base.pfpUseWhiteRing,
    title: base.title,
    subtitle: base.subtitle,
    ...CLUB_EXTRA[key],
  };
}
