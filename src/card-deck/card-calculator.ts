import { type DataProvider } from '../common/data-provider'
import { type Card } from '../master-data/card'
import { type GameCharacter } from '../master-data/game-character'
import { findOrThrow } from '../util/array-util'
import { type UserCard } from '../user-data/user-card'
import { type CardEpisode } from '../master-data/card-episode'
import { type MasterLesson } from '../master-data/master-lesson'
import { type CharacterRank } from '../master-data/character-rank'
import { type UserCharacter } from '../user-data/user-character'

export class CardCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
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
   * 获取卡牌基础综合力（含卡牌等级、觉醒、突破等级、前后篇），这部分综合力直接显示在卡牌右上角，分为3个子属性
   * @param userCard 用户卡牌（要看卡牌等级、觉醒状态、突破等级、前后篇解锁状态）
   * @param card 卡牌
   * @private
   */
  private async getCardBasePowers (userCard: UserCard, card: Card): Promise<number[]> {
    const cardEpisodes = await this.dataProvider.getMasterData('cardEpisodes') as CardEpisode[]
    const masterLessons = await this.dataProvider.getMasterData('masterLessons') as MasterLesson[]

    const ret = [0, 0, 0]
    // 等级
    const cardParameters = card.cardParameters.filter(it => it.cardLevel === userCard.level)
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
    const episodes = userCard.episodes.filter(it => it.scenarioStatus === 'already_read')
      .map(it => findOrThrow(cardEpisodes, e => e.id === it.cardEpisodeId))
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

  private async getAreaItemBonusPower (
    basePower: number[], unit: string, sameUnit: boolean, attr: string, sameAttr: boolean
  ): Promise<number> {
    return 0
  }

  /**
   * 获取卡牌角色加成综合力
   * @param basePower 卡牌基础综合力
   * @param characterId 角色ID
   * @private
   */
  private async getCharacterBonusPower (basePower: number[], characterId: number): Promise<number> {
    const characterRanks = await this.dataProvider.getMasterData('characterRanks') as CharacterRank[]
    const userCharacters = await this.dataProvider.getUserData('userCharacters') as UserCharacter[]

    const userCharacter = findOrThrow(userCharacters, it => it.characterId === characterId)
    const characterRank = findOrThrow(characterRanks,
      it => it.characterId === userCharacter.characterId && it.characterRank === userCharacter.characterRank)
    const rates = [characterRank.power1BonusRate, characterRank.power2BonusRate, characterRank.power3BonusRate]
    return rates.reduce((v, it, i) => v + Math.floor(basePower[i] * it / 100), 0)
  }
}

/**
 * 计算过程中使用的卡牌详情信息
 */
export interface CardDetail {
  units: string[]
  attr: string
  power: CardDetailMap
  scoreSkill: CardDetailMap
  lifeSkill: number
  eventBonus: number
}

/**
 * 用于记录在不同的同组合、同属性加成的情况下的综合力或加分技能
 */
class CardDetailMap {
  public min = Number.MAX_SAFE_INTEGER
  public max = Number.MIN_SAFE_INTEGER
  public values = new Map<string, number>()

  public set (unit: string, attr: string, value: number): void {
    this.min = Math.min(this.min, value)
    this.max = Math.max(this.max, value)
    this.values.set(CardDetailMap.getKey(unit, attr), value)
  }

  public get (unit: string, attr: string): number | undefined {
    return this.values.get(CardDetailMap.getKey(unit, attr))
  }

  /**
   * 用于map的key
   * @param unit 组合（mix代表非同组合加成）
   * @param attr 属性（mix代表非同属性加成）
   */
  public static getKey (unit: string, attr: string): string {
    return `${unit}-${attr}`
  }

  /**
   * 是否肯定比另一个范围小
   * 如果几个维度都比其他小，这张卡可以在自动组卡时舍去
   * @param another 另一个范围
   */
  public isCertainlyLessThen (another: CardDetailMap): boolean {
    // 如果自己最大值比别人最小值还要小，说明自己肯定小
    return this.max < another.min
  }
}
