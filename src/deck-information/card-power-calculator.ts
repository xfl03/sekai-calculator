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
import { type DeckCardPowerDetail } from './deck-calculator'

export class CardPowerCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 计算在不同情况（组合属性人数不同）下的综合力
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param cardUnits 卡牌所属组合（因为计算逻辑在CardCalculator里面，传参来避免循环构造）
   * @param userAreaItemLevels 用户拥有的区域道具等级
   */
  public async getCardPower (
    userCard: UserCard, card: Card, cardUnits: string[], userAreaItemLevels: AreaItemLevel[]
  ): Promise<CardDetailMap<DeckCardPowerDetail>> {
    const ret = new CardDetailMap<DeckCardPowerDetail>()
    // 处理区域道具以外的综合力，这些与队友无关
    const basePower = await this.getCardBasePowers(userCard, card)
    const characterBonus = await this.getCharacterBonusPower(basePower, card.characterId)
    // 处理区域道具，每个组合和属性需要计算4种情况
    for (const unit of cardUnits) {
      // 同组合、同属性
      let power = await this.getPower(
        card, basePower, characterBonus, userAreaItemLevels, unit, true, true)
      ret.set(unit, 5, 5, power.total, power)
      // 同组合、混属性
      power = await this.getPower(
        card, basePower, characterBonus, userAreaItemLevels, unit, true, false)
      ret.set(unit, 5, 1, power.total, power)
      // 混组合、同属性
      power = await this.getPower(
        card, basePower, characterBonus, userAreaItemLevels, unit, false, true)
      ret.set(unit, 1, 5, power.total, power)
      // 混组合、混属性
      power = await this.getPower(
        card, basePower, characterBonus, userAreaItemLevels, unit, false, false)
      ret.set(unit, 1, 1, power.total, power)
    }
    return ret
  }

  /**
   * 获得卡牌在特定情况下的综合力
   * 将基础综合、角色加成、区域道具加成三部分合一
   * @param card 卡牌
   * @param basePower 基础综合
   * @param characterBonus 角色加成
   * @param userAreaItemLevels 用户拥有的区域道具等级
   * @param unit 组合
   * @param sameUnit 是否同组
   * @param sameAttr 是否同色
   * @private
   */
  private async getPower (
    card: Card, basePower: number[], characterBonus: number,
    userAreaItemLevels: AreaItemLevel[], unit: string, sameUnit: boolean, sameAttr: boolean
  ): Promise<DeckCardPowerDetail> {
    const base = basePower.reduce((v, it) => v + it, 0)
    const areaItemBonus = await this.getAreaItemBonusPower(
      userAreaItemLevels, basePower, card.characterId, unit, sameUnit, card.attr, sameAttr)
    return {
      base,
      areaItemBonus,
      characterBonus,
      total: base + characterBonus + areaItemBonus
    }
  }

  /**
   * 获取卡牌基础综合力（含卡牌等级、觉醒、突破等级、前后篇），这部分综合力直接显示在卡牌右上角，分为3个子属性
   * @param userCard 用户卡牌（要看卡牌等级、觉醒状态、突破等级、前后篇解锁状态）
   * @param card 卡牌
   * @private
   */
  private async getCardBasePowers (userCard: UserCard, card: Card): Promise<number[]> {
    const p = await Promise.all([
      await this.dataProvider.getMasterData<CardEpisode>('cardEpisodes'),
      await this.dataProvider.getMasterData<MasterLesson>('masterLessons')
    ])
    const cardEpisodes = p[0]
    const masterLessons = p[1]

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
      areaItemBonus[0] = Math.fround(areaItemBonus[0] +
        Math.fround(allMatch ? areaItem.power1AllMatchBonusRate : areaItem.power1BonusRate))
      areaItemBonus[1] = Math.fround(areaItemBonus[1] +
        Math.fround(allMatch ? areaItem.power2AllMatchBonusRate : areaItem.power2BonusRate))
      areaItemBonus[2] = Math.fround(areaItemBonus[2] +
        Math.fround(allMatch ? areaItem.power3AllMatchBonusRate : areaItem.power3BonusRate))
    }
    // 三个维度单独计算后向下取整再累加
    return basePower
      .reduce((v, it, i) => v + Math.floor(Math.fround(it * Math.fround(areaItemBonus[i] * Math.fround(0.01)))), 0)
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
      Math.fround(characterRank.power1BonusRate),
      Math.fround(characterRank.power2BonusRate),
      Math.fround(characterRank.power3BonusRate)
    ]
    return rates
      .reduce((v, it, i) => v + Math.floor(Math.fround(basePower[i] * Math.fround(it * Math.fround(0.01)))), 0)
  }
}
