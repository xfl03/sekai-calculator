import { type DataProvider } from '../data-provider/data-provider'
import type { UserCard } from '../user-data/user-card'
import { type UserHonor } from '../user-data/user-honor'
import { type Honor } from '../master-data/honor'
import { CardCalculator, type CardDetail } from '../card-information/card-calculator'
import { computeWithDefault, findOrThrow, getOrThrow } from '../util/collection-util'
import { EventCalculator } from '../event-point/event-calculator'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { type EventConfig, type EventType } from '../event-point/event-service'
import { safeNumber } from '../util/number-util'

export class DeckCalculator {
  private readonly cardCalculator: CardCalculator
  private readonly eventCalculator: EventCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.eventCalculator = new EventCalculator(dataProvider)
  }

  /**
   * 获取称号的综合力加成（与卡牌无关、根据称号累加）
   */
  public async getHonorBonusPower (): Promise<number> {
    const honors = await this.dataProvider.getMasterData<Honor>('honors')
    const userHonors = await this.dataProvider.getUserData<UserHonor[]>('userHonors')
    return userHonors
      .map(userHonor => {
        const honor = findOrThrow(honors, it => it.id === userHonor.honorId)
        return findOrThrow(honor.levels, it => it.level === userHonor.level)
      })
      .reduce((v, it) => v + it.bonus, 0)
  }

  /**
   * 计算给定的多张卡牌综合力、技能
   * @param cardDetails 处理好的卡牌详情（数组长度1-5，兼容挑战Live）
   * @param allCards 参与计算的所有卡，按支援队伍加成从大到小排序
   * @param honorBonus 称号加成
   * @param eventType 活动类型（用于算加成）
   */
  public async getDeckDetailByCards (
    cardDetails: CardDetail[], allCards: CardDetail[], honorBonus: number, eventType?: EventType
  ): Promise<DeckDetail> {
    // 预处理队伍和属性，存储每个队伍或属性出现的次数
    const map = new Map<string, number>()
    for (const cardDetail of cardDetails) {
      computeWithDefault(map, cardDetail.attr, 0, it => it + 1)
      cardDetail.units.forEach(key => {
        computeWithDefault(map, key, 0, it => it + 1)
      })
    }

    // 计算当前卡组的综合力，要加上称号的固定加成
    const cardPower = new Map<number, DeckCardPowerDetail>()
    cardDetails.forEach(cardDetail => {
      cardPower.set(cardDetail.cardId, cardDetail.units.reduce((vv, unit) => {
        const current = cardDetail.power.get(unit, getOrThrow(map, unit), getOrThrow(map, cardDetail.attr))
        // 有多个组合时，取最高加成组合
        return current.total > vv.total ? current : vv
      },
      // 随便取一个当默认值
      cardDetail.power.get(cardDetail.units[0], getOrThrow(map, cardDetail.units[0]), getOrThrow(map, cardDetail.attr))
      ))
    })

    const base = cardDetails.reduce((v, cardDetail) =>
      v + getOrThrow(cardPower, cardDetail.cardId).base,
    0)
    const areaItemBonus = cardDetails.reduce((v, cardDetail) =>
      v + getOrThrow(cardPower, cardDetail.cardId).areaItemBonus,
    0)
    const characterBonus = cardDetails.reduce((v, cardDetail) =>
      v + getOrThrow(cardPower, cardDetail.cardId).characterBonus,
    0)
    const total = base + areaItemBonus + characterBonus + honorBonus
    const power = {
      base,
      areaItemBonus,
      characterBonus,
      honorBonus,
      total
    }

    // 计算当前卡组的技能效果，并归纳卡牌在队伍中的详情信息
    const cards = cardDetails.map(cardDetail => {
      const skill = cardDetail.units.reduce((vv, unit) => {
      // 有多个组合时，取最高组合
        const current = cardDetail.skill.get(unit, getOrThrow(map, unit), 1)
        return current.scoreUp > vv.scoreUp ? current : vv
      },
      cardDetail.skill.get(cardDetail.units[0], getOrThrow(map, cardDetail.units[0]), 1))
      return {
        cardId: cardDetail.cardId,
        level: cardDetail.level,
        skillLevel: cardDetail.skillLevel,
        masterRank: cardDetail.masterRank,
        power: getOrThrow(cardPower, cardDetail.cardId),
        eventBonus: cardDetail.eventBonus,
        skill
      }
    })
    // 计算卡组活动加成
    const eventBonus = await this.eventCalculator.getDeckBonus(cardDetails, eventType)
    const supportDeckBonus = EventCalculator.getSupportDeckBonus(cardDetails, allCards)
    return {
      power,
      eventBonus,
      supportDeckBonus,
      cards
    }
  }

  /**
   * 根据用户卡组获得卡组详情
   * @param deckCards 用户卡组中的用户卡牌
   * @param allCards 用户全部卡牌
   * @param eventConfig （可选）活动设置
   * @param areaItemLevels （可选）使用的区域道具
   */
  public async getDeckDetail (
    deckCards: UserCard[], allCards: UserCard[], eventConfig?: EventConfig, areaItemLevels?: AreaItemLevel[]
  ): Promise<DeckDetail> {
    let allCards0 = await this.cardCalculator.batchGetCardDetail(allCards, {}, eventConfig, areaItemLevels)
    // 如果是给世界开花活动算的话，allCards一定要按支援加成从大到小排序
    if (eventConfig?.specialCharacterId !== undefined && eventConfig.specialCharacterId > 0) {
      allCards0 = allCards0.sort((a, b) => safeNumber(b.supportDeckBonus) - safeNumber(a.supportDeckBonus))
    }
    return await this.getDeckDetailByCards(
      await this.cardCalculator.batchGetCardDetail(deckCards, {}, eventConfig, areaItemLevels),
      allCards0,
      await this.getHonorBonusPower())
  }
}

export interface DeckDetail {
  power: DeckPowerDetail
  eventBonus?: number
  supportDeckBonus?: number
  cards: DeckCardDetail[]
}

export interface DeckCardDetail {
  cardId: number
  level: number
  skillLevel: number
  masterRank: number
  power: DeckCardPowerDetail
  eventBonus?: number
  skill: DeckCardSkillDetail
}

export interface DeckPowerDetail {
  base: number
  areaItemBonus: number
  characterBonus: number
  honorBonus: number
  total: number
}

export interface DeckCardPowerDetail {
  base: number
  areaItemBonus: number
  characterBonus: number
  total: number
}

export interface DeckCardSkillDetail {
  scoreUp: number
  lifeRecovery: number
}
