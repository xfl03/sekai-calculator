import { type DataProvider } from '../common/data-provider'
import { type Card } from '../master-data/card'
import { type GameCharacter } from '../master-data/game-character'
import { findOrThrow } from '../util/collection-util'
import { CardPowerCalculator } from './card-power-calculator'
import { CardSkillCalculator } from './card-skill-calculator'
import { type UserCard } from '../user-data/user-card'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { type CardDetailMap } from './card-detail-map'
import { type UserArea } from '../user-data/user-area'
import { CardEventCalculator } from '../event-point/card-event-calculator'

export class CardCalculator {
  private readonly powerCalculator: CardPowerCalculator
  private readonly skillCalculator: CardSkillCalculator
  private readonly eventCalculator: CardEventCalculator
  public constructor (private readonly dataProvider: DataProvider) {
    this.powerCalculator = new CardPowerCalculator(dataProvider)
    this.skillCalculator = new CardSkillCalculator(dataProvider)
    this.eventCalculator = new CardEventCalculator(dataProvider)
  }

  /**
   * 获得卡牌组合信息（包括原始组合与应援组合）
   * @param card 卡牌
   * @private
   */
  private async getCardUnits (card: Card): Promise<string[]> {
    const gameCharacters = await this.dataProvider.getMasterData('gameCharacters') as GameCharacter[]
    // 组合（V家支援组合、角色原始组合）
    const units = [] as string[]
    if (card.supportUnit !== 'none') units.push(card.supportUnit)
    units.push(findOrThrow(gameCharacters, it => it.id === card.characterId).unit)
    return units
  }

  /**
   * 获取卡牌详细数据
   * @param userCard 用户卡牌
   * @param userAreaItemLevels 用户拥有的区域道具等级
   * @param eventId 活动ID（如果非0则计算活动加成）
   */
  public async getCardDetail (
    userCard: UserCard, userAreaItemLevels: AreaItemLevel[], eventId: number = 0
  ): Promise<CardDetail> {
    const cards = await this.dataProvider.getMasterData('cards') as Card[]
    const card = findOrThrow(cards, it => it.id === userCard.cardId)
    const units = await this.getCardUnits(card)

    const skill = await this.skillCalculator.getCardSkill(userCard, card)
    const power =
      await this.powerCalculator.getCardPower(userCard, card, units, userAreaItemLevels)
    const eventBonus = eventId === 0 ? undefined : await this.eventCalculator.getCardEventBonus(userCard, eventId)
    return {
      cardId: card.id,
      characterId: card.characterId,
      units,
      attr: card.attr,
      power,
      scoreSkill: skill.scoreUp,
      lifeSkill: skill.lifeRecovery,
      eventBonus
    }
  }

  /**
   * 批量获取卡牌详细数据
   * @param userCards 多张卡牌
   * @param eventId 活动ID（如果非0则计算活动加成）
   */
  public async batchGetCardDetail (userCards: UserCard[], eventId: number = 0): Promise<CardDetail[]> {
    const areaItemLevels = await this.dataProvider.getMasterData('areaItemLevels') as AreaItemLevel[]
    const userAreas = await this.dataProvider.getUserData('userAreas') as UserArea[]
    const userItemLevels = userAreas.flatMap(it => it.areaItems).map(areaItem =>
      findOrThrow(areaItemLevels, it => it.areaItemId === areaItem.areaItemId && it.level === areaItem.level))
    return await Promise.all(
      userCards.map(async it => await this.getCardDetail(it, userItemLevels, eventId)))
  }

  /**
   * 卡牌是否肯定劣于另一张卡牌
   * @param cardDetail0 卡牌
   * @param cardDetail1 另一张卡牌
   */
  public static isCertainlyLessThan (
    cardDetail0: CardDetail, cardDetail1: CardDetail
  ): boolean {
    return cardDetail0.power.isCertainlyLessThen(cardDetail1.power) &&
      cardDetail0.scoreSkill.isCertainlyLessThen(cardDetail1.scoreSkill) &&
      (cardDetail0.eventBonus === undefined || cardDetail1.eventBonus === undefined ||
        cardDetail0.eventBonus < cardDetail1.eventBonus)
  }
}

/**
 * 计算过程中使用的卡牌详情信息
 */
export interface CardDetail {
  cardId: number
  characterId: number
  units: string[]
  attr: string
  power: CardDetailMap
  scoreSkill: CardDetailMap
  lifeSkill: number
  eventBonus?: number
}
