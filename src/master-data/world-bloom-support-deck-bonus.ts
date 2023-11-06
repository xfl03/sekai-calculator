export interface WorldBloomSupportDeckBonus {
  cardRarityType: string
  worldBloomSupportDeckCharacterBonuses: Array<{
    id: number
    worldBloomSupportDeckCharacterType: string
    bonusRate: number
  }>
  worldBloomSupportDeckMasterRankBonuses: Array<{
    id: number
    masterRank: number
    bonusRate: number
  }>
  worldBloomSupportDeckSkillLevelBonuses: Array<{
    id: number
    skillLevel: number
    bonusRate: number
  }>
}
