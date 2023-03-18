export interface Skill {
  id: number
  shortDescription: string
  description: string
  descriptionSpriteName: string
  skillFilterId: number
  skillEffects: Array<{
    id: number
    skillEffectType: string
    activateNotesJudgmentType: string
    skillEffectDetails: Array<{
      id: number
      level: number
      activateEffectDuration: number
      activateEffectValueType: string
      activateEffectValue: number
    }>
    skillEnhance?: {
      id: number
      skillEnhanceType: string
      activateEffectValueType: string
      activateEffectValue: number
      skillEnhanceCondition: {
        id: number
        seq: number
        unit: string
      }
    }
  }>
}
