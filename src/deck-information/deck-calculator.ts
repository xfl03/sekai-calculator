import { type DataProvider } from '../data-provider/data-provider'
import type { UserCard } from '../user-data/user-card'
import { type UserHonor } from '../user-data/user-honor'
import { type Honor } from '../master-data/honor'
import { CardCalculator, type CardDetail } from '../card-information/card-calculator'
import { computeWithDefault, findOrThrow, getOrThrow } from '../util/collection-util'
import { EventCalculator } from '../event-point/event-calculator'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { type EventConfig } from '../event-point/event-service'
import type { WorldBloomDifferentAttributeBonus } from '../master-data/world-bloom-different-attribute-bonus'

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
   * @param cardBonusCountLimit 特定卡牌加成数量限制（用于World Link Finale）
   * @param worldBloomDifferentAttributeBonuses （可选）World Link不同属性加成
   */
  public static getDeckDetailByCards (
    cardDetails: CardDetail[], allCards: CardDetail[], honorBonus: number, cardBonusCountLimit?: number,
    worldBloomDifferentAttributeBonuses?: WorldBloomDifferentAttributeBonus[]
  ): DeckDetail {
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
      cardPower.set(cardDetail.cardId,
        cardDetail.units.reduce((vv, unit) => {
          const current =
            cardDetail.power.getPower(unit, getOrThrow(map, unit), getOrThrow(map, cardDetail.attr))
          // 有多个组合时，取最高加成组合
          return current.total > vv.total ? current : vv
        },
        // 随便取一个当默认值，不会影响结果
        cardDetail.power.getPower(cardDetail.units[0],
          getOrThrow(map, cardDetail.units[0]), getOrThrow(map, cardDetail.attr))
        ))
    })

    const base = DeckCalculator.sumPower(cardDetails, cardPower, it => it.base)
    const areaItemBonus = DeckCalculator.sumPower(cardDetails, cardPower,
      it => it.areaItemBonus)
    const characterBonus = DeckCalculator.sumPower(cardDetails, cardPower,
      it => it.characterBonus)
    const fixtureBonus = DeckCalculator.sumPower(cardDetails, cardPower,
      it => it.fixtureBonus)
    const gateBonus = DeckCalculator.sumPower(cardDetails, cardPower,
      it => it.gateBonus)
    const total = DeckCalculator.sumPower(cardDetails, cardPower,
      it => it.total) + honorBonus
    const power = {
      base,
      areaItemBonus,
      characterBonus,
      honorBonus,
      fixtureBonus,
      gateBonus,
      total
    }

    // 计算当前卡组的技能效果，并归纳卡牌在队伍中的详情信息
    const cardsPrepare = cardDetails.map(cardDetail => {
      const skillPrepare =
          cardDetail.units.reduce((vv, unit) => {
            // 有多个组合时，取最高组合
            const current = cardDetail.skill.getSkill(unit, getOrThrow(map, unit))
            return current.scoreUpFixed > vv.scoreUpFixed ? current : vv
          },
          // 取新FES V家觉醒前的异组合为默认值
          // 会自动回落到固定值的默认技能
          cardDetail.skill.getSkill('diff', map.size - 1))
      return {
        cardDetail,
        skillPrepare
      }
    })

    // 预备完技能效果后，再计算吸技能
    const cards = cardsPrepare.map((it, i) => {
      const { cardDetail, skillPrepare } = it
      let scoreUp = skillPrepare.scoreUpFixed
      // 针对吸技能的情况特殊计算
      if (skillPrepare.scoreUpReference !== undefined) {
        // 计算其他卡中最高的被吸技能效果
        const otherCardSkillMax = cardsPrepare
          .filter(it => it.cardDetail.cardId !== cardDetail.cardId)
          .reduce((v, it) =>
            Math.max(v, it.skillPrepare.scoreUpToReference), 0)
        const { scoreUpReference } = skillPrepare
        // 按比例吸技能，并更新结果
        let newScoreUp = scoreUpReference.base + Math.floor(otherCardSkillMax * scoreUpReference.rate / 100)
        newScoreUp = Math.min(newScoreUp, scoreUpReference.max) // 有上限
        scoreUp = Math.max(scoreUp, newScoreUp) // 取最高
      }
      return {
        cardId: cardDetail.cardId,
        level: cardDetail.level,
        skillLevel: cardDetail.skillLevel,
        masterRank: cardDetail.masterRank,
        power: getOrThrow(cardPower, cardDetail.cardId),
        eventBonus: cardDetail.eventBonus?.getBonusForDisplay(i === 0),
        skill: {
          scoreUp,
          lifeRecovery: skillPrepare.lifeRecovery
        }
      }
    })

    // 计算卡组活动加成
    const eventBonus = EventCalculator.getDeckBonus(
      cardDetails, cardBonusCountLimit, worldBloomDifferentAttributeBonuses)
    // World Link活动还有支援卡组加成
    const supportDeckBonus =
        worldBloomDifferentAttributeBonuses !== undefined
          ? EventCalculator.getSupportDeckBonus(cardDetails, allCards).bonus
          : 0
    return {
      power,
      eventBonus,
      supportDeckBonus,
      cards
    }
  }

  /**
   * 求和单项综合力
   * @param cardDetails 卡组
   * @param cardPower 计算出来的综合力
   * @param attr 单项综合力属性
   * @private
   */
  private static sumPower (
    cardDetails: CardDetail[], cardPower: Map<number, DeckCardPowerDetail>,
    attr: (_: DeckCardPowerDetail) => number
  ): number {
    return cardDetails.reduce((v, cardDetail) =>
      v + attr(getOrThrow(cardPower, cardDetail.cardId)),
    0)
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
    const allCards0 =
        await this.cardCalculator.batchGetCardDetail(allCards, {}, eventConfig, areaItemLevels)

    return DeckCalculator.getDeckDetailByCards(
      await this.cardCalculator.batchGetCardDetail(deckCards, {}, eventConfig, areaItemLevels),
      allCards0, await this.getHonorBonusPower(), eventConfig?.cardBonusCountLimit, eventConfig?.worldBloomDifferentAttributeBonuses)
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
  eventBonus?: string
  skill: DeckCardSkillDetail
}

export interface DeckPowerDetail {
  base: number
  areaItemBonus: number
  characterBonus: number
  honorBonus: number
  fixtureBonus: number
  gateBonus: number
  total: number
}

export interface DeckCardPowerDetail {
  base: number
  areaItemBonus: number
  characterBonus: number
  fixtureBonus: number
  gateBonus: number
  total: number
}

export interface DeckCardSkillDetail {
  /**
   * 最终计算出的卡组加分
   */
  scoreUp: number
  lifeRecovery: number
}
