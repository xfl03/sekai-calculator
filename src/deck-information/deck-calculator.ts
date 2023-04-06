import { type DataProvider } from '../data-provider/data-provider'
import type { UserCard } from '../user-data/user-card'
import { type UserHonor } from '../user-data/user-honor'
import { type Honor } from '../master-data/honor'
import { CardCalculator, type CardDetail } from './card-calculator'
import { computeWithDefault, findOrThrow, getOrThrow } from '../util/collection-util'
import { EventCalculator } from '../event-point/event-calculator'

export class DeckCalculator {
  private readonly cardCalculator: CardCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
  }

  /**
   * 获取称号的综合力加成（与卡牌无关、根据称号累加）
   */
  public async getHonorBonusPower (): Promise<number> {
    const honors = await this.dataProvider.getMasterData('honors') as Honor[]
    const userHonors = await this.dataProvider.getUserData('userHonors') as UserHonor[]
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
   * @param honorBonus 称号加成
   */
  public static getDeckDetailByCards (cardDetails: CardDetail[], honorBonus: number): DeckDetail {
    // 预处理队伍和属性，存储每个队伍或属性出现的次数
    const map = new Map<string, number>()
    for (const cardDetail of cardDetails) {
      computeWithDefault(map, cardDetail.attr, 0, it => it + 1)
      cardDetail.units.forEach(key => {
        computeWithDefault(map, key, 0, it => it + 1)
      })
    }

    // 计算当前卡组的综合力，要加上称号的固定加成
    const cardPower = new Map<number, number>()
    cardDetails.forEach(cardDetail => {
      cardPower.set(cardDetail.cardId, cardDetail.units.reduce((vv, unit) =>
      // 有多个组合时，取最高加成组合
        Math.max(vv, cardDetail.power.get(unit, getOrThrow(map, unit), getOrThrow(map, cardDetail.attr))),
      0))
    })
    const power = cardDetails.reduce((v, cardDetail) =>
      v + getOrThrow(cardPower, cardDetail.cardId),
    0) + honorBonus

    // 计算当前卡组的技能效果，并归纳卡牌在队伍中的详情信息
    const cards = cardDetails.map(cardDetail => {
      const scoreUp = cardDetail.units.reduce((vv, unit) =>
      // 有多个组合时，取最高组合
        Math.max(vv, cardDetail.scoreSkill.get(unit, getOrThrow(map, unit), 1)),
      0)
      return {
        cardId: cardDetail.cardId,
        power: getOrThrow(cardPower, cardDetail.cardId),
        scoreUp,
        lifeRecovery: cardDetail.lifeSkill
      }
    })
    // 计算卡组活动加成
    const eventBonus = EventCalculator.getDeckBonus(cardDetails)
    return {
      power,
      eventBonus,
      cards
    }
  }

  /**
   * 根据用户卡组获得卡组详情
   * @param deckCards 用户卡组中的用户卡牌
   */
  public async getDeckDetail (deckCards: UserCard[]): Promise<DeckDetail> {
    return DeckCalculator.getDeckDetailByCards(
      await this.cardCalculator.batchGetCardDetail(deckCards), await this.getHonorBonusPower())
  }
}

export interface DeckDetail {
  power: number
  eventBonus?: number
  cards: DeckCardDetail[]
}

export interface DeckCardDetail {
  cardId: number
  power: number
  scoreUp: number
  lifeRecovery: number
}
