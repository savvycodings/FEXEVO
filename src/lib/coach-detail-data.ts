import type { CoachId } from "../navigation/types";

export type CoachDetailModel = {
  id: CoachId;
  /** Row card shown in invite list (same as `coach-invite-data`). */
  listBanner: number;
  displayName: string;
  fullLegalName: string;
  headline: string;
  birthDisplay: string;
  locationDisplay: string;
  achievementTitle: string;
  achievementSubtitle: string;
  perfilBody: string;
};

const COACH_DETAIL: Record<CoachId, CoachDetailModel> = {
  carlos: {
    id: "carlos",
    listBanner: require("../../assets/coachs/carlos.png"),
    displayName: "Carlos Moreno",
    fullLegalName: "Carlos Moreno Holguin",
    headline: "Jugador Profesional de Pádel & Coach",
    birthDisplay: "15 Nov 2002",
    locationDisplay: "Madrid, Spain",
    achievementTitle: "Campeón Panamericano",
    achievementSubtitle: "Sub-14 Brasil",
    perfilBody:
      "Soy un jugador profesional de pádel con una sólida experiencia internacional y enfoque en el desarrollo técnico y táctico. Acompaño a jugadores de todos los niveles para mejorar su juego, confianza en pista y disfrute del deporte.",
  },
  steve: {
    id: "steve",
    listBanner: require("../../assets/coachs/steve.png"),
    displayName: "Steve Shuga",
    fullLegalName: "Steve Shuga",
    headline: "Personalized Trainer · Miami",
    birthDisplay: "22 Jul 1988",
    locationDisplay: "Miami, USA",
    achievementTitle: "Club leagues",
    achievementSubtitle: "Youth & adults",
    perfilBody:
      "Combina fundamentos sólidos y entrenamiento funcional para que progreses con seguridad y constancia.",
  },
  slama: {
    id: "slama",
    listBanner: require("../../assets/coachs/slama.png"),
    displayName: "Slama Splinter",
    fullLegalName: "Slama Splinter",
    headline: "PRO Player · International circuit",
    birthDisplay: "3 Jan 1995",
    locationDisplay: "Moscow, Russia",
    achievementTitle: "FIP stages",
    achievementSubtitle: "Europe & LATAM",
    perfilBody:
      "Jugador profesional con enfoque en intensidad, lectura de pista y preparación física de alto rendimiento.",
  },
};

export function getCoachDetail(id: string): CoachDetailModel | null {
  const key = id.trim() as CoachId;
  if (key !== "steve" && key !== "carlos" && key !== "slama") return null;
  return COACH_DETAIL[key];
}
