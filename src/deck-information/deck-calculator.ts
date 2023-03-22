import type { DataProvider } from '../common/data-provider'
import type { UserCard } from '../user-data/user-card'
import { type UserHonor } from '../user-data/user-honor'
import { type Honor } from '../master-data/honor'
import { CardCalculator, type CardDetail } from './card-calculator'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { computeWithDefault, findOrThrow, getOrThrow } from '../util/collection-util'
import { type UserArea } from '../user-data/user-area'

export class DeckCalculator {
  private readonly cardCalculator: CardCalculator
  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
  }

  /**
   * 获取称号的综合力加成（与卡牌无关、根据称号累加）
   */
  private async getHonorBonusPower (): Promise<number> {
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
  public async getDeckDetailByCards (cardDetails: CardDetail[], honorBonus: number): Promise<DeckDetail> {
    // 预处理队伍和属性，存储每个队伍或属性出现的次数
    const map = new Map<string, number>()
    for (const cardDetail of cardDetails) {
      computeWithDefault(map, cardDetail.attr, 0, it => it + 1)
      cardDetail.units.forEach(key => { computeWithDefault(map, key, 0, it => it + 1) })
    }
    // 计算当前卡组的综合力，要加上称号的固定加成
    const power = cardDetails.reduce((v, cardDetail) =>
      v + cardDetail.units.reduce((vv, unit) =>
      // 有多个组合时，取最高加成组合
        Math.max(vv, cardDetail.power.get(unit, getOrThrow(map, unit), getOrThrow(map, cardDetail.attr))),
      0),
    0) + honorBonus
    // 计算当前卡组的技能效果
    const skill = cardDetails.map(cardDetail => {
      const scoreUp = cardDetail.units.reduce((vv, unit) =>
      // 有多个组合时，取最高组合
        Math.max(vv, cardDetail.scoreSkill.get(unit, getOrThrow(map, unit), 1)),
      0)
      return {
        cardId: cardDetail.cardId,
        scoreUp,
        lifeRecovery: cardDetail.lifeSkill
      }
    })
    return { power, skill }
  }

  /**
   * 根据用户卡组获得卡组详情
   * @param deckCards 用户卡组中的用户卡牌
   */
  public async getDeckDetail (deckCards: UserCard[]): Promise<DeckDetail> {
    const areaItemLevels = await this.dataProvider.getMasterData('areaItemLevels') as AreaItemLevel[]
    const userAreas = await this.dataProvider.getUserData('userAreas') as UserArea[]
    const userItemLevels = userAreas.flatMap(it => it.areaItems).map(areaItem =>
      findOrThrow(areaItemLevels, it => it.areaItemId === areaItem.areaItemId && it.level === areaItem.level))
    const cardDetails = await Promise.all(
      deckCards.map(async it => await this.cardCalculator.getCardDetail(it, userItemLevels)))
    return await this.getDeckDetailByCards(cardDetails, await this.getHonorBonusPower())
  }
}

export interface DeckDetail {
  power: number
  skill: SkillDetail[]
}
export interface SkillDetail { cardId?: number, scoreUp: number, lifeRecovery: number }
