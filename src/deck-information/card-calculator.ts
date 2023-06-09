import { type DataProvider } from '../data-provider/data-provider'
import { type Card } from '../master-data/card'
import { type GameCharacter } from '../master-data/game-character'
import { findOrThrow } from '../util/collection-util'
import { CardPowerCalculator } from './card-power-calculator'
import { CardSkillCalculator } from './card-skill-calculator'
import { type UserCard } from '../user-data/user-card'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { type CardDetailMap } from './card-detail-map'
import { CardEventCalculator } from '../event-point/card-event-calculator'
import { type CardRarity } from '../master-data/card-rarity'
import { AreaItemService } from '../area-item-information/area-item-service'
import { type DeckCardPowerDetail, type DeckCardSkillDetail } from './deck-calculator'

export class CardCalculator {
  private readonly powerCalculator: CardPowerCalculator
  private readonly skillCalculator: CardSkillCalculator
  private readonly eventCalculator: CardEventCalculator
  private readonly areaItemService: AreaItemService

  public constructor (private readonly dataProvider: DataProvider) {
    this.powerCalculator = new CardPowerCalculator(dataProvider)
    this.skillCalculator = new CardSkillCalculator(dataProvider)
    this.eventCalculator = new CardEventCalculator(dataProvider)
    this.areaItemService = new AreaItemService(dataProvider)
  }

  /**
   * 获得卡牌组合信息（包括原始组合与应援组合）
   * @param card 卡牌
   * @private
   */
  private async getCardUnits (card: Card): Promise<string[]> {
    const gameCharacters = await this.dataProvider.getMasterData<GameCharacter>('gameCharacters')
    // 组合（V家支援组合、角色原始组合）
    const units = [] as string[]
    if (card.supportUnit !== 'none') units.push(card.supportUnit)
    units.push(findOrThrow(gameCharacters, it => it.id === card.characterId).unit)
    return units
  }

  /**
   * 应用卡牌设置
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param cardRarities 卡牌稀有度
   * @param rankMax 强制满级
   * @param episodeRead 强制前后篇
   * @param masterMax 强制满破
   * @param skillMax 强制满技能
   * @private
   */
  private async applyCardConfig (
    userCard: UserCard, card: Card, {
      rankMax = false,
      episodeRead = false,
      masterMax = false,
      skillMax = false
    }: CardConfig = {}
  ): Promise<UserCard> {
    // 都按原样，那就什么都无需调整
    if (!rankMax && !episodeRead && !masterMax && !skillMax) return userCard

    const cardRarities = await this.dataProvider.getMasterData<CardRarity>('cardRarities')
    const cardRarity = findOrThrow(cardRarities, it => it.cardRarityType === card.cardRarityType)
    // 深拷贝一下原始对象，避免污染
    const ret = JSON.parse(JSON.stringify(userCard)) as UserCard

    // 处理最大等级
    if (rankMax) {
      // 是否可以觉醒
      if (cardRarity.trainingMaxLevel !== undefined) {
        ret.level = cardRarity.trainingMaxLevel
        ret.specialTrainingStatus = 'done'
      } else {
        ret.level = cardRarity.maxLevel
      }
    }

    // 处理前后篇解锁
    if (episodeRead && ret.episodes !== undefined) {
      ret.episodes.forEach(it => {
        it.scenarioStatus = 'already_read'
      })
    }

    // 突破
    if (masterMax) {
      ret.masterRank = 5
    }

    // 技能
    if (skillMax) {
      ret.skillLevel = cardRarity.maxSkillLevel
    }
    return ret
  }

  /**
   * 获取卡牌详细数据
   * @param userCard 用户卡牌
   * @param userAreaItemLevels 用户拥有的区域道具等级
   * @param config 卡牌设置
   * @param eventId 活动ID（如果非0则计算活动加成）
   */
  public async getCardDetail (
    userCard: UserCard, userAreaItemLevels: AreaItemLevel[], config: Record<string, CardConfig> = {}, eventId: number = 0
  ): Promise<CardDetail> {
    const cards = await this.dataProvider.getMasterData<Card>('cards')
    const card = findOrThrow(cards, it => it.id === userCard.cardId)
    const units = await this.getCardUnits(card)

    const userCard0 = await this.applyCardConfig(userCard, card, config[card.cardRarityType])

    const skill = await this.skillCalculator.getCardSkill(userCard0, card)
    const power =
      await this.powerCalculator.getCardPower(userCard0, card, units, userAreaItemLevels)
    const eventBonus = eventId === 0 ? undefined : await this.eventCalculator.getCardEventBonus(userCard0, eventId)
    return {
      cardId: card.id,
      level: userCard0.level,
      skillLevel: userCard0.skillLevel,
      masterRank: userCard0.masterRank,
      cardRarityType: card.cardRarityType,
      characterId: card.characterId,
      units,
      attr: card.attr,
      power,
      skill,
      eventBonus
    }
  }

  /**
   * 批量获取卡牌详细数据
   * @param userCards 多张卡牌
   * @param config 卡牌设置
   * @param eventId 活动ID（如果非0则计算活动加成）
   * @param areaItemLevels （可选）纳入计算的区域道具等级
   */
  public async batchGetCardDetail (
    userCards: UserCard[], config: Record<string, CardConfig> = {}, eventId: number = 0, areaItemLevels?: AreaItemLevel[]
  ): Promise<CardDetail[]> {
    const areaItemLevels0 = areaItemLevels === undefined
      ? await this.areaItemService.getAreaItemLevels()
      : areaItemLevels
    return await Promise.all(
      userCards.map(async it => await this.getCardDetail(it, areaItemLevels0, config, eventId))
    )
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
      cardDetail0.skill.isCertainlyLessThen(cardDetail1.skill) &&
      (cardDetail0.eventBonus === undefined || cardDetail1.eventBonus === undefined ||
        cardDetail0.eventBonus <= cardDetail1.eventBonus)
  }
}

/**
 * 计算过程中使用的卡牌详情信息
 */
export interface CardDetail {
  cardId: number
  level: number
  skillLevel: number
  masterRank: number
  cardRarityType: string
  characterId: number
  units: string[]
  attr: string
  power: CardDetailMap<DeckCardPowerDetail>
  skill: CardDetailMap<DeckCardSkillDetail>
  eventBonus?: number
}

export interface CardConfig {
  /**
   * 直接按满级计算
   * 不然按卡牌等级计算
   */
  rankMax?: boolean
  /**
   * 直接按前后篇解锁计算
   * 不然按卡牌前后篇计算
   */
  episodeRead?: boolean
  /**
   * 是否按满破计算
   * 不然按实际突破计算
   */
  masterMax?: boolean
  /**
   * 是否按技能满级计算
   */
  skillMax?: boolean
}
