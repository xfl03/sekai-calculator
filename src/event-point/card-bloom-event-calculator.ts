import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { findOrThrow } from '../util/collection-util'
import { type WorldBloomSupportDeckBonus } from '../master-data/world-bloom-support-deck-bonus'
import { type EventConfig } from './event-service'
import { type GameCharacterUnit } from '../master-data/game-character-unit'
import { CardService } from '../card-information/card-service'

export class CardBloomEventCalculator {
  private readonly cardService: CardService
  public constructor (private readonly dataProvider: DataProvider) {
    this.cardService = new CardService(dataProvider)
  }

  public async getCardSupportDeckBonus (userCard: UserCard, {
    specialCharacterId = 0
  }: EventConfig): Promise<number> {
    // 未指定角色的话，就按0支援加成算
    if (specialCharacterId <= 0) return 0
    const cards = await this.dataProvider.getMasterData<Card>('cards')
    const card = findOrThrow(cards, it => it.id === userCard.cardId)

    // 需要先判断一张卡牌是否是指定组合，如果不是的话没有加成
    const gameCharacterUnits =
      await this.dataProvider.getMasterData<GameCharacterUnit>('gameCharacterUnits')
    const specialUnit = findOrThrow(gameCharacterUnits,
      it => it.gameCharacterId === specialCharacterId).unit
    const cardUnits = await this.cardService.getCardUnits(card)
    if (!cardUnits.includes(specialUnit)) return 0

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
