import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { type CardEpisode } from '../master-data/card-episode'
import { type MasterLesson } from '../master-data/master-lesson'
import { findOrThrow } from '../util/collection-util'
import { type AreaItemLevel } from '../master-data/area-item-level'
import { type CharacterRank } from '../master-data/character-rank'
import { type UserCharacter } from '../user-data/user-character'
import { CardDetailMap } from './card-detail-map'
import { type DeckCardPowerDetail } from '../deck-information/deck-calculator'
import { type CardMysekaiCanvasBonus } from '../master-data/card-mysekai-canvas-bonus'
import type {
  UserMysekaiFixtureGameCharacterPerformanceBonus
} from '../user-data/user-mysekai-fixture-game-character-performance-bonus'
import { type MysekaiGateBonus } from '../mysekai-information/mysekai-service'

export class CardPowerCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 计算在不同情况（组合属性人数不同）下的综合力
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param cardUnits 卡牌所属组合（因为计算逻辑在CardCalculator里面，传参来避免循环构造）
   * @param userAreaItemLevels 用户拥有的区域道具等级
   * @param hasCanvasBonus 是否拥有自定义世界中的画布
   * @param userGateBonuses 用户拥有的自定义世界大门加成
   */
  public async getCardPower (
    userCard: UserCard, card: Card, cardUnits: string[], userAreaItemLevels: AreaItemLevel[], hasCanvasBonus: boolean,
    userGateBonuses: MysekaiGateBonus[]
  ): Promise<CardDetailMap<DeckCardPowerDetail>> {
    const ret = new CardDetailMap<DeckCardPowerDetail>()
    // 处理区域道具以外的综合力，这些与队友无关
    const basePower = await this.getCardBasePowers(userCard, card)
    const canvasBonus = await this.getMysekaiCanvasBonus(card, hasCanvasBonus)
    const characterBonus = await this.getCharacterBonusPower(basePower, card.characterId)
    const fixtureBonus = await this.getFixtureBonusPower(basePower, canvasBonus, card.characterId)
    const gateBonus = await this.getGateBonusPower(basePower, canvasBonus, userGateBonuses, cardUnits)
    // 处理区域道具，每个组合和属性需要计算4种情况
    for (const unit of cardUnits) {
      // 同组合、同属性
      let power = await this.getPower(
        card, basePower, canvasBonus, characterBonus, fixtureBonus, gateBonus,
        userAreaItemLevels, unit, true, true)
      ret.set(unit, 5, 5, power.total, power)
      // 同组合、混属性
      power = await this.getPower(
        card, basePower, canvasBonus, characterBonus, fixtureBonus, gateBonus,
        userAreaItemLevels, unit, true, false)
      ret.set(unit, 5, 1, power.total, power)
      // 混组合、同属性
      power = await this.getPower(
        card, basePower, canvasBonus, characterBonus, fixtureBonus, gateBonus,
        userAreaItemLevels, unit, false, true)
      ret.set(unit, 1, 5, power.total, power)
      // 混组合、混属性
      power = await this.getPower(
        card, basePower, canvasBonus, characterBonus, fixtureBonus, gateBonus,
        userAreaItemLevels, unit, false, false)
      ret.set(unit, 1, 1, power.total, power)
    }
    return ret
  }

  /**
   * 获得卡牌在特定情况下的综合力
   * 将基础综合、角色加成、区域道具加成三部分合一
   * @param card 卡牌
   * @param basePower 基础综合
   * @param canvasBonusPower 画布加成
   * @param characterBonus 角色加成
   * @param fixtureBonus 家具加成
   * @param gateBonus 大门加成
   * @param userAreaItemLevels 用户拥有的区域道具等级
   * @param unit 组合
   * @param sameUnit 是否同组
   * @param sameAttr 是否同色
   * @private
   */
  private async getPower (
    card: Card, basePower: number[], canvasBonusPower: number[], characterBonus: number,
    fixtureBonus: number, gateBonus: number,
    userAreaItemLevels: AreaItemLevel[], unit: string, sameUnit: boolean, sameAttr: boolean
  ): Promise<DeckCardPowerDetail> {
    const base = basePower.reduce((v, it) => v + it, 0)
    const canvasBonus = canvasBonusPower.reduce((v, it) => v + it, 0)
    const areaItemBonus = await this.getAreaItemBonusPower(
      userAreaItemLevels, basePower, card.characterId, unit, sameUnit, card.attr, sameAttr)
    return {
      base,
      canvasBonus,
      areaItemBonus,
      characterBonus,
      fixtureBonus,
      gateBonus,
      total: base + canvasBonus + areaItemBonus + characterBonus + fixtureBonus + gateBonus
    }
  }

  /**
   * 获取卡牌基础综合力（含卡牌等级、觉醒、突破等级、前后篇），这部分综合力直接显示在卡牌右上角，分为3个子属性
   * @param userCard 用户卡牌（要看卡牌等级、觉醒状态、突破等级、前后篇解锁状态）
   * @param card 卡牌
   * @private
   */
  private async getCardBasePowers (userCard: UserCard, card: Card): Promise<number[]> {
    const [
      cardEpisodes,
      masterLessons
    ] = await Promise.all([
      await this.dataProvider.getMasterData<CardEpisode>('cardEpisodes'),
      await this.dataProvider.getMasterData<MasterLesson>('masterLessons')
    ])

    const ret = [0, 0, 0]
    // 等级
    const cardParameters = card.cardParameters
      .filter(it => it.cardLevel === userCard.level)
    const params = ['param1', 'param2', 'param3']// cardParameterType的枚举
    params.forEach((param, i) => {
      ret[i] = findOrThrow(cardParameters, it => it.cardParameterType === param).power
    })
    // 觉醒
    if (userCard.specialTrainingStatus === 'done') {
      ret[0] += card.specialTrainingPower1BonusFixed
      ret[1] += card.specialTrainingPower2BonusFixed
      ret[2] += card.specialTrainingPower3BonusFixed
    }
    // 剧情
    const episodes = userCard.episodes === undefined
      ? []// 有一张卡没剧情
      : userCard.episodes.filter(it => it.scenarioStatus === 'already_read')
        .map(it =>
          findOrThrow(cardEpisodes, e => e.id === it.cardEpisodeId))
    for (const episode of episodes) {
      ret[0] += episode.power1BonusFixed
      ret[1] += episode.power2BonusFixed
      ret[2] += episode.power3BonusFixed
    }
    // 突破
    const usedMasterLessons = masterLessons
      .filter((it: any) => it.cardRarityType === card.cardRarityType && it.masterRank <= userCard.masterRank)
    for (const masterLesson of usedMasterLessons) {
      ret[0] += masterLesson.power1BonusFixed
      ret[1] += masterLesson.power2BonusFixed
      ret[2] += masterLesson.power3BonusFixed
    }
    return ret
  }

  /**
   * 获得自定义世界画布加成
   * 这项加成看似在基础属性中，其实不享受区域道具、角色等级加成，但会享受自定义世界家具、门加成，所以需要单独拿出来算
   * @param card 卡牌
   * @param hasMysekaiCanvas 是否拥有自定义世界中的画布
   */
  private async getMysekaiCanvasBonus (card: Card, hasMysekaiCanvas: boolean): Promise<number[]> {
    const ret = [0, 0, 0]
    // 自定义世界画布加成
    if (hasMysekaiCanvas) {
      const cardMysekaiCanvasBonuses = await this.dataProvider.getMasterData<CardMysekaiCanvasBonus>('cardMysekaiCanvasBonuses')
      const canvasBonus = findOrThrow(cardMysekaiCanvasBonuses, it => it.cardRarityType === card.cardRarityType)
      ret[0] += canvasBonus.power1BonusFixed
      ret[1] += canvasBonus.power2BonusFixed
      ret[2] += canvasBonus.power3BonusFixed
    }
    return ret
  }

  /**
   * 获得区域道具加成的综合力
   * @param userAreaItemLevels 用户所持的区域道具等级
   * @param basePower 卡牌基础综合力
   * @param characterId 角色ID
   * @param unit 用于加成的组合
   * @param sameUnit 是否同组合
   * @param attr 用于加成的属性
   * @param sameAttr 是否同属性
   * @private
   */
  private async getAreaItemBonusPower (
    userAreaItemLevels: AreaItemLevel[], basePower: number[],
    characterId: number, unit: string, sameUnit: boolean, attr: string, sameAttr: boolean
  ): Promise<number> {
    // 筛选可以使用的区域道具
    const usedAreaItems = userAreaItemLevels.filter(it =>
      (it.targetUnit === 'any' || it.targetUnit === unit) &&
      (it.targetCardAttr === 'any' || it.targetCardAttr === attr) &&
      (it.targetGameCharacterId === undefined || it.targetGameCharacterId === characterId)
    )
    // 累加各个区域道具的加成
    const areaItemBonus = [0, 0, 0]
    for (const areaItem of usedAreaItems) {
      const allMatch = (areaItem.targetUnit !== 'any' && sameUnit) ||
        (areaItem.targetCardAttr !== 'any' && sameAttr)
      const rates = [
        allMatch ? areaItem.power1AllMatchBonusRate : areaItem.power1BonusRate,
        allMatch ? areaItem.power2AllMatchBonusRate : areaItem.power2BonusRate,
        allMatch ? areaItem.power3AllMatchBonusRate : areaItem.power3BonusRate
      ]
      rates.forEach((rate, i) => {
        areaItemBonus[i] = Math.fround(areaItemBonus[i] +
          Math.fround(Math.fround(Math.fround(rate) * Math.fround(0.01)) * basePower[i]))
      })
    }
    // 三个维度单独计算后向下取整再累加
    return areaItemBonus.reduce((v, it) => v + Math.floor(it), 0)
  }

  /**
   * 获取卡牌角色加成综合力
   * @param basePower 卡牌基础综合力
   * @param characterId 角色ID
   * @private
   */
  private async getCharacterBonusPower (basePower: number[], characterId: number): Promise<number> {
    const characterRanks = await this.dataProvider.getMasterData<CharacterRank>('characterRanks')
    const userCharacters = await this.dataProvider.getUserData<UserCharacter[]>('userCharacters')

    const userCharacter =
      findOrThrow(userCharacters, it => it.characterId === characterId)
    const characterRank = findOrThrow(characterRanks,
      it => it.characterId === userCharacter.characterId &&
        it.characterRank === userCharacter.characterRank)
    const rates = [
      characterRank.power1BonusRate,
      characterRank.power2BonusRate,
      characterRank.power3BonusRate
    ]
    return rates
      .reduce((v, it, i) => v +
        Math.floor(Math.fround(Math.fround(Math.fround(it) * Math.fround(0.01)) * basePower[i])), 0)
  }

  /**
   * 计算自定义世界中的家具加成（玩偶）
   * @param basePower 卡牌基础综合力
   * @param canvasBonus 画布增加的综合力
   * @param characterId 角色ID
   */
  private async getFixtureBonusPower (basePower: number[], canvasBonus: number[], characterId: number): Promise<number> {
    const userFixtureBonuses =
        await this.dataProvider.getUserData<UserMysekaiFixtureGameCharacterPerformanceBonus[]>(
          'userMysekaiFixtureGameCharacterPerformanceBonuses')
    if (userFixtureBonuses === undefined || userFixtureBonuses === null || userFixtureBonuses.length === 0) {
      return 0
    }

    // 寻找对应的加成，如果没有任何加成会空
    const fitureBonus = userFixtureBonuses
      .find(it => it.gameCharacterId === characterId)
    if (fitureBonus === undefined || fitureBonus === null) {
      return 0
    }

    // 按各个综合分别计算加成，其中totalBonusRate单位是0.1%
    return CardPowerCalculator.mixBasePower(basePower, canvasBonus).reduce((v, it) => v +
        Math.floor(Math.fround(it * Math.fround(fitureBonus.totalBonusRate * Math.fround(0.001)))), 0)
  }

  /**
   * 自定义世界的大门加成
   * 如果是无应援的V家角色，按最大加成算
   * @param basePower 基础综合
   * @param canvasBonus 画布加成
   * @param userGateBonuses 当前生效的门加成
   * @param cardUnits 当前卡有的组合
   */
  private async getGateBonusPower (
    basePower: number[], canvasBonus: number[], userGateBonuses: MysekaiGateBonus[], cardUnits: string[]
  ): Promise<number> {
    // 因为没有专门的V家加成，需要特殊判定无应援的V家角色
    const isOnlyPiapro = cardUnits.length === 1 && cardUnits[0] === 'piapro'
    // 找到可以使用的最高加成
    let powerBonusRate = 0
    for (const bonus of userGateBonuses) {
      if (isOnlyPiapro || cardUnits.includes(bonus.unit)) {
        powerBonusRate = Math.max(powerBonusRate, bonus.powerBonusRate)
      }
    }
    // 按各个综合分别计算加成，其中powerBonusRate单位是1%
    return CardPowerCalculator.mixBasePower(basePower, canvasBonus).reduce((v, it) => v +
        Math.floor(Math.fround(it * Math.fround(Math.fround(powerBonusRate) * Math.fround(0.01)))), 0)
  }

  /**
   * 混合面板值（基础属性+画布加成）
   * @param basePower
   * @param canvasBonus
   * @private
   */
  private static mixBasePower (basePower: number[], canvasBonus: number[]): number[] {
    return [basePower[0] + canvasBonus[0], basePower[1] + canvasBonus[1], basePower[2] + canvasBonus[2]]
  }
}
