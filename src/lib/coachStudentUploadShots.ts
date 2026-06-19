import type { TrainCategory, TrainStrokePreset } from './train-taxonomy'

export type CoachUploadShotItem = {
  labelKey: string
  /** Second line (e.g. “(wall exit)”) — keeps chip height aligned with single-line shots. */
  labelLine2Key?: string
  presetId: TrainStrokePreset
}

export type CoachUploadShotSection = {
  sectionTitleKey: string
  shots: CoachUploadShotItem[]
}

/** Coach student upload — shots grouped by section (UI mockup order). */
export const COACH_STUDENT_UPLOAD_SHOT_SECTIONS: Partial<
  Record<TrainCategory, CoachUploadShotSection[]>
> = {
  save_return: [
    {
      sectionTitleKey: 'studentProfile.shotSections.serve',
      shots: [
        { labelKey: 'studentProfile.shots.flatServe', presetId: 'forehand_drive' },
        { labelKey: 'studentProfile.shots.sliceServe', presetId: 'backhand_drive_with_wall' },
        { labelKey: 'studentProfile.shots.kickServe', presetId: 'forehand_drive' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.return',
      shots: [
        { labelKey: 'studentProfile.shots.forehandReturn', presetId: 'forehand_return_with_lob' },
        { labelKey: 'studentProfile.shots.backhandReturn', presetId: 'backhand_return' },
        { labelKey: 'studentProfile.shots.backhandReturnLob', presetId: 'backhand_return_with_lob' },
        { labelKey: 'studentProfile.shots.forehandReturnLob', presetId: 'forehand_return_with_lob' },
        { labelKey: 'studentProfile.shots.chiquitaReturn', presetId: 'forehand_chiquita' },
      ],
    },
  ],
  ground_strokes: [
    {
      sectionTitleKey: 'studentProfile.shotSections.drives',
      shots: [
        { labelKey: 'studentProfile.shots.forehandDrive', presetId: 'forehand_drive' },
        { labelKey: 'studentProfile.shots.backhandDrive', presetId: 'backhand_drive' },
        { labelKey: 'studentProfile.shots.forehandDriveWallExit', labelLine2Key: 'studentProfile.shots.wallExit', presetId: 'forehand_drive' },
        { labelKey: 'studentProfile.shots.backhandDriveWallExit', labelLine2Key: 'studentProfile.shots.wallExit', presetId: 'backhand_drive_with_wall' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.lobs',
      shots: [
        { labelKey: 'studentProfile.shots.forehandLob', presetId: 'forehand_lob' },
        { labelKey: 'studentProfile.shots.backhandLob', presetId: 'backhand_lob' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.controlShots',
      shots: [
        { labelKey: 'studentProfile.shots.forehandChiquita', presetId: 'forehand_chiquita' },
        { labelKey: 'studentProfile.shots.backhandChiquita', presetId: 'backhand_drive' },
        { labelKey: 'studentProfile.shots.dropShotDejada', presetId: 'contrapared_boast' },
      ],
    },
  ],
  net_play: [
    {
      sectionTitleKey: 'studentProfile.shotSections.volleys',
      shots: [
        { labelKey: 'studentProfile.shots.forehandVolley', presetId: 'forehand_volley' },
        { labelKey: 'studentProfile.shots.backhandVolley', presetId: 'backhand_volley' },
        { labelKey: 'studentProfile.shots.blockVolley', presetId: 'half_volley' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.transition',
      shots: [
        { labelKey: 'studentProfile.shots.halfVolley', presetId: 'half_volley' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.controlAndFinishing',
      shots: [
        { labelKey: 'studentProfile.shots.dropVolley', labelLine2Key: 'studentProfile.shots.dormilona', presetId: 'contrapared_boast' },
        { labelKey: 'studentProfile.shots.angleVolley', presetId: 'forehand_volley' },
        { labelKey: 'studentProfile.shots.deepVolley', presetId: 'backhand_volley' },
      ],
    },
  ],
  defence_glass: [
    {
      sectionTitleKey: 'studentProfile.shotSections.backWall',
      shots: [
        { labelKey: 'studentProfile.shots.backWallForehand', presetId: 'back_wall_forehand' },
        { labelKey: 'studentProfile.shots.backWall', labelLine2Key: 'studentProfile.shots.backhand', presetId: 'back_wall_backhand' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.sideWall',
      shots: [
        { labelKey: 'studentProfile.shots.sideWallForehand', presetId: 'side_wall_forehand' },
        { labelKey: 'studentProfile.shots.sideWall', labelLine2Key: 'studentProfile.shots.backhand', presetId: 'side_wall_backhand' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.doubleWall',
      shots: [
        { labelKey: 'studentProfile.shots.doubleWall', labelLine2Key: 'studentProfile.shots.forehand', presetId: 'side_wall_forehand' },
        { labelKey: 'studentProfile.shots.doubleWall', labelLine2Key: 'studentProfile.shots.backhand', presetId: 'side_wall_backhand' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.wallCombinations',
      shots: [
        { labelKey: 'studentProfile.shots.backWallToSideWall', labelLine2Key: 'studentProfile.shots.sideWallLower', presetId: 'side_wall_forehand' },
        { labelKey: 'studentProfile.shots.sideWallToBackWall', labelLine2Key: 'studentProfile.shots.backWallLower', presetId: 'side_wall_backhand' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.advancedDefense',
      shots: [
        { labelKey: 'studentProfile.shots.contrapared', labelLine2Key: 'studentProfile.shots.boast', presetId: 'contrapared_boast' },
        { labelKey: 'studentProfile.shots.counterWall', labelLine2Key: 'studentProfile.shots.forehand', presetId: 'side_wall_forehand' },
        { labelKey: 'studentProfile.shots.counterWall', labelLine2Key: 'studentProfile.shots.backhand', presetId: 'side_wall_backhand' },
        { labelKey: 'studentProfile.shots.glassExit', labelLine2Key: 'studentProfile.shots.salidaDePared', presetId: 'back_wall_forehand' },
      ],
    },
  ],
  overhead: [
    {
      sectionTitleKey: 'studentProfile.shotSections.overheadControl',
      shots: [
        { labelKey: 'studentProfile.shots.bandeja', presetId: 'bandeja' },
        { labelKey: 'studentProfile.shots.vibora', presetId: 'backhand_volley' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.power',
      shots: [
        { labelKey: 'studentProfile.shots.flatSmash', presetId: 'forehand_drive' },
        { labelKey: 'studentProfile.shots.kickSmash', presetId: 'forehand_drive' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.winners',
      shots: [
        { labelKey: 'studentProfile.shots.por3Smash', presetId: 'forehand_drive' },
        { labelKey: 'studentProfile.shots.por4Smash', presetId: 'forehand_lob' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.advancedOverhead',
      shots: [
        { labelKey: 'studentProfile.shots.gancho', presetId: 'forehand_chiquita' },
        { labelKey: 'studentProfile.shots.rulo', presetId: 'backhand_return' },
        { labelKey: 'studentProfile.shots.bajada', presetId: 'bandeja' },
        { labelKey: 'studentProfile.shots.cuchilla', presetId: 'backhand_volley' },
      ],
    },
  ],
  tactical_specials: [
    {
      sectionTitleKey: 'studentProfile.shotSections.transition',
      shots: [
        { labelKey: 'studentProfile.shots.bajadaTactical', labelLine2Key: 'studentProfile.shots.wallToAttack', presetId: 'bandeja' },
        { labelKey: 'studentProfile.shots.approachShot', presetId: 'forehand_drive' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.tactical',
      shots: [
        { labelKey: 'studentProfile.shots.passingShot', presetId: 'forehand_drive' },
        { labelKey: 'studentProfile.shots.bodyShot', presetId: 'backhand_drive' },
        { labelKey: 'studentProfile.shots.shotToFeet', presetId: 'backhand_lob' },
        { labelKey: 'studentProfile.shots.tacticalLob', presetId: 'forehand_lob' },
      ],
    },
    {
      sectionTitleKey: 'studentProfile.shotSections.creativeEmergency',
      shots: [
        { labelKey: 'studentProfile.shots.offCourtRecovery', presetId: 'side_wall_forehand' },
        { labelKey: 'studentProfile.shots.behindTheBack', labelLine2Key: 'studentProfile.shots.cadete', presetId: 'backhand_return' },
        { labelKey: 'studentProfile.shots.fakeShotFeint', presetId: 'forehand_chiquita' },
      ],
    },
  ],
}

export function coachUploadCategoryTitleKey(category: TrainCategory): string {
  const map: Partial<Record<TrainCategory, string>> = {
    save_return: 'studentProfile.categories.serveReturn',
    ground_strokes: 'studentProfile.categories.groundstrokes',
    net_play: 'studentProfile.categories.netPlay',
    defence_glass: 'studentProfile.categories.defenseWalls',
    overhead: 'studentProfile.categories.overheads',
    tactical_specials: 'studentProfile.categories.tacticalSpecials',
  }
  return map[category] ?? 'studentProfile.shotCategoryTitle'
}
