import type { CoachId } from "../navigation/types";

/**
 * Coach tab: full-width row artboards (370×105) — same layout as `slama.png`.
 */
export const COACH_INVITE_CARDS: readonly {
  id: CoachId;
  source: number;
  accessibilityLabel: string;
}[] = [
  {
    id: "steve",
    source: require("../../assets/coachs/steve.png"),
    accessibilityLabel: "Steve Shuga, Personalized Trainer, Miami",
  },
  {
    id: "carlos",
    source: require("../../assets/coachs/carlos.png"),
    accessibilityLabel: "Carlos Moreno, Trainer, Madrid",
  },
  {
    id: "slama",
    source: require("../../assets/coachs/slama.png"),
    accessibilityLabel: "Slama Splinter, PRO Player, Moscow",
  },
];

export const COACH_CARD_ASPECT = 105 / 370;
