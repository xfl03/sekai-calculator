import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { findOrThrow } from '../util/collection-util'
import { type WorldBloomSupportDeckBonus } from '../master-data/world-bloom-support-deck-bonus'

export class CardBloomEventCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  public async getCardSupportDeckBonus (userCard: UserCard, specialCharacterId: number): Promise<number> {
    const cards = await this.dataProvider.getMasterData<Card>('cards')
    const card = findOrThrow(cards, it => it.id === userCard.cardId)
    const worldBloomSupportDeckBonuses =
      await this.dataProvider.getMasterData<WorldBloomSupportDeckBonus>('worldBloomSupportDeckBonuses')
    const bonus = findOrThrow(worldBloomSupportDeckBonuses,
      it => it.cardRarityType === card.cardRarityType)
    let total = 0

    // 角色加成
    const type =
      card.characterId === specialCharacterId ? 'specific' : 'others'
    total += findOrThrow(bonus.worldBloomSupportDeckCharacterBonuses,
      it => it.worldBloomSupportDeckCharacterType === type).bonusRate
    // 专精等级加成
    total += findOrThrow(bonus.worldBloomSupportDeckMasterRankBonuses,
      it => it.masterRank === userCard.masterRank).bonusRate
    // 技能等级加成
    total += findOrThrow(bonus.worldBloomSupportDeckSkillLevelBonuses,
      it => it.skillLevel === userCard.skillLevel).bonusRate

    return total
  }
}
