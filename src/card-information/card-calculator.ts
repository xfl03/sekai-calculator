import { type DataProvider } from '../data-provider/data-provider'
import { type Card } from '../master-data/card'
import { findOrThrow } from '../util/collection-util'
import { CardPowerCalculator } from './card-power-calculator'
import { CardSkillCalculator } from './card-skill-calculator'
import { type UserCard } from '../user-data/user-card'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { CardEventCalculator } from '../event-point/card-event-calculator'
import { AreaItemService } from '../area-item-information/area-item-service'
import { type EventConfig } from '../event-point/event-service'
import { CardBloomEventCalculator } from '../event-point/card-bloom-event-calculator'
import { CardService } from './card-service'
import { safeNumber } from '../util/number-util'
import { type MysekaiGateBonus, MysekaiService } from '../mysekai-information/mysekai-service'
import { type CardDetailMapPower } from './card-detail-map-power'
import { type CardDetailMapSkill } from './card-detail-map-skill'
import { type CardDetailMapEventBonus } from './card-detail-map-event-bonus'

export class CardCalculator {
  private readonly powerCalculator: CardPowerCalculator
  private readonly skillCalculator: CardSkillCalculator
  private readonly eventCalculator: CardEventCalculator
  private readonly bloomEventCalculator: CardBloomEventCalculator
  private readonly areaItemService: AreaItemService
  private readonly cardService: CardService
  private readonly mysekaiService: MysekaiService

  public constructor (private readonly dataProvider: DataProvider) {
    this.powerCalculator = new CardPowerCalculator(dataProvider)
    this.skillCalculator = new CardSkillCalculator(dataProvider)
    this.eventCalculator = new CardEventCalculator(dataProvider)
    this.bloomEventCalculator = new CardBloomEventCalculator(dataProvider)
    this.areaItemService = new AreaItemService(dataProvider)
    this.cardService = new CardService(dataProvider)
    this.mysekaiService = new MysekaiService(dataProvider)
  }

  /**
   * 获取卡牌详细数据
   * @param userCard 用户卡牌
   * @param userAreaItemLevels 用户拥有的区域道具等级
   * @param config 卡牌设置
   * @param eventId 活动ID（如果非0则计算活动加成）
   * @param specialCharacterId 指定的角色ID（用于World Finale活动支援卡组加成）
   * @param scoreUpLimit 卡牌技能限制（用于World Link Finale）
   * @param mysekaiFixtureLimit My SEKAI家具加成限制（用于World Link Finale）
   * @param hasCanvasBonus 是否拥有自定义世界中的画布
   * @param userGateBonuses 用户拥有的大门加成
   */
  public async getCardDetail (
    userCard: UserCard, userAreaItemLevels: AreaItemLevel[], config: Record<string, CardConfig> = {}, {
      eventId = 0,
      specialCharacterId = 0,
      skillScoreUpLimit = Number.MAX_SAFE_INTEGER,
      mysekaiFixtureLimit = Number.MAX_SAFE_INTEGER
    }: EventConfig = {}, hasCanvasBonus: boolean, userGateBonuses: MysekaiGateBonus[]
  ): Promise<CardDetail | undefined> {
    const cards = await this.dataProvider.getMasterData<Card>('cards')
    const card = findOrThrow(cards, it => it.id === userCard.cardId)

    const config0 = config[card.cardRarityType]
    if (config0 !== undefined && config0.disable === true) return undefined // 忽略被禁用的稀有度卡牌

    const userCard0 = await this.cardService.applyCardConfig(userCard, card, config0)

    const units = await this.cardService.getCardUnits(card)
    const skill = await this.skillCalculator.getCardSkill(userCard0, card, skillScoreUpLimit)
    const power =
      await this.powerCalculator.getCardPower(
        userCard0, card, units, userAreaItemLevels, hasCanvasBonus, userGateBonuses, mysekaiFixtureLimit)
    const eventBonus = eventId === 0
      ? undefined
      : await this.eventCalculator.getCardEventBonus(userCard0, eventId)
    const supportDeckBonus =
      await this.bloomEventCalculator.getCardSupportDeckBonus(userCard0, { eventId, specialCharacterId })
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
      eventBonus,
      supportDeckBonus,
      hasCanvasBonus
    }
  }

  /**
   * 批量获取卡牌详细数据
   * @param userCards 多张卡牌
   * @param config 卡牌设置
   * @param eventConfig 活动设置
   * @param areaItemLevels （可选）纳入计算的区域道具等级
   */
  public async batchGetCardDetail (
    userCards: UserCard[], config: Record<string, CardConfig> = {},
    eventConfig?: EventConfig, areaItemLevels?: AreaItemLevel[]
  ): Promise<CardDetail[]> {
    const areaItemLevels0 = areaItemLevels === undefined
      ? await this.areaItemService.getAreaItemLevels()
      : areaItemLevels
    // 自定义世界专项加成
    const userCanvasBonusCards = await this.mysekaiService.getMysekaiCanvasBonusCards()
    const userGateBonuses = await this.mysekaiService.getMysekaiGateBonuses()
    // 每张卡单独计算
    const ret = await Promise.all(
      userCards.map(async it =>
        await this.getCardDetail(it, areaItemLevels0, config, eventConfig, userCanvasBonusCards.has(it.cardId),
          userGateBonuses))
    ).then(it => it.filter(it => it !== undefined)) as CardDetail[]
    // 如果是给World Link活动算的话，allCards一定要按支援加成从大到小排序
    if (eventConfig?.specialCharacterId !== undefined && eventConfig.specialCharacterId > 0) {
      return ret.sort((a, b) =>
        safeNumber(b.supportDeckBonus) - safeNumber(a.supportDeckBonus))
    }
    return ret
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
        cardDetail0.eventBonus.isCertainlyLessThen(cardDetail1.eventBonus))
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
  power: CardDetailMapPower
  skill: CardDetailMapSkill
  eventBonus?: CardDetailMapEventBonus
  supportDeckBonus?: number
  hasCanvasBonus: boolean
}

export interface CardConfig {
  /**
   * 禁用此稀有度卡牌
   */
  disable?: boolean
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
