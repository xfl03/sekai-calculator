import { type DataProvider } from '../data-provider/data-provider'
import { DeckCalculator, type DeckDetail, type SkillDetail } from '../deck-information/deck-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { duplicateObj, findOrThrow } from '../util/collection-util'
import { type CardDetail } from '../deck-information/card-calculator'

export class LiveCalculator {
  private readonly deckCalculator: DeckCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.deckCalculator = new DeckCalculator(dataProvider)
  }

  /**
   * 获取歌曲数据
   * @param musicId 歌曲ID
   * @param musicDiff 歌曲难度
   */
  public async getMusicMeta (musicId: number, musicDiff: string): Promise<MusicMeta> {
    const musicMetas = await this.dataProvider.getMusicMeta() as MusicMeta[]
    return findOrThrow(musicMetas, it => it.music_id === musicId && it.difficulty === musicDiff)
  }

  /**
   * 获得基础分数
   * @param musicMeta 歌曲数据
   * @param liveType Live类型
   * @private
   */
  private static getBaseScore (musicMeta: MusicMeta, liveType: LiveType): number {
    switch (liveType) {
      case LiveType.SOLO:
      case LiveType.CHALLENGE:
        return musicMeta.base_score
      case LiveType.MULTI:
      case LiveType.CHEERFUL:
        return musicMeta.base_score + musicMeta.fever_score
      case LiveType.AUTO:
        return musicMeta.base_score_auto
    }
  }

  /**
   * 获得技能分数
   * @param musicMeta 歌曲数据
   * @param liveType Live类型
   * @private
   */
  private static getSkillScore (musicMeta: MusicMeta, liveType: LiveType): number[] {
    switch (liveType) {
      case LiveType.SOLO:
      case LiveType.CHALLENGE:
        return musicMeta.skill_score_solo
      case LiveType.MULTI:
      case LiveType.CHEERFUL:
        return musicMeta.skill_score_multi
      case LiveType.AUTO:
        return musicMeta.skill_score_auto
    }
  }

  /**
   * 根据给定的卡组和歌曲数据计算Live详情
   * @param deckDetail 卡组信息
   * @param musicMeta 歌曲数据
   * @param liveType Live类型
   * @param skillDetails 技能顺序（小于5后面技能留空、如果是多人需要放入加权后的累加值），如果留空则计算当前技能多人效果或最佳技能
   * @param multiPowerSum 多人队伍综合力总和（用于计算活跃加成，留空则使用5倍当前卡组综合力）
   */
  public static getLiveDetailByDeck (
    deckDetail: DeckDetail, musicMeta: MusicMeta, liveType: LiveType,
    skillDetails: SkillDetail[] | undefined = undefined, multiPowerSum: number = 0
  ): LiveDetail {
    // 确定技能发动顺序，未指定则直接按效果排序或多人重复当前技能
    const skills = skillDetails !== undefined
      ? skillDetails
      : (liveType === LiveType.MULTI
          ? duplicateObj(LiveCalculator.getMultiLiveSkill(deckDetail), 6)
        // 按效果排序前5个技能、第6个固定为C位
          : [...[...deckDetail.skill].sort((a, b) => a.scoreUp - b.scoreUp),
              deckDetail.skill[0]])
    // 与技能无关的分数比例
    const baseRate = LiveCalculator.getBaseScore(musicMeta, liveType)
    // 技能分数比例，如果是最佳技能计算则按加成排序（复制一下防止影响原数组顺序）
    const skillScores = [...LiveCalculator.getSkillScore(musicMeta, liveType)]
    const skillRate = skillDetails === undefined
      // 按效果排序前5次技能、第6个固定（与上面的技能排序相对应）
      ? [...skillScores.slice(0, 5).sort((a, b) => a - b), skillScores[5]]
      : skillScores
    // 计算总的分数比例
    const rate = baseRate + skills.reduce((v, it, i) => v + it.scoreUp * skillRate[i] / 100, 0)
    const life = skills.reduce((v, it) => v + it.lifeRecovery, 0)
    // 活跃加分
    const powerSum = multiPowerSum === 0 ? 5 * deckDetail.power : multiPowerSum
    const activeBonus = liveType === LiveType.MULTI ? 5 * 0.015 * powerSum : 0
    return {
      score: Math.floor(rate * deckDetail.power * 4 + activeBonus),
      time: musicMeta.music_time,
      life: Math.min(2000, life + 1000),
      tap: musicMeta.tap_count
    }
  }

  /**
   * 获得当前卡组在多人Live下的技能
   * @param deckDetail 卡组信息
   * @private
   */
  private static getMultiLiveSkill (deckDetail: DeckDetail): SkillDetail {
    // 多人技能加分效果计算规则：C位100%发动、其他位置20%发动
    const scoreUp = deckDetail.skill.reduce((v, it, i) =>
      v + (i === 0 ? it.scoreUp : (it.scoreUp / 5)), 0)
    // 奶判只看C位
    const lifeRecovery = deckDetail.skill[0].lifeRecovery
    return {
      scoreUp,
      lifeRecovery
    }
  }

  /**
   * 按给定顺序计算单人技能效果
   * @param liveSkills 技能顺序（可以小于6个）
   * @param skillDetails 卡组技能信息
   * @private
   */
  private static getSoloLiveSkill (
    liveSkills: LiveSkill[] | undefined, skillDetails: SkillDetail[]
  ): SkillDetail[] | undefined {
    if (liveSkills === undefined) return undefined
    const skills = liveSkills.map(liveSkill => findOrThrow(skillDetails, it => it.cardId === liveSkill.cardId))
    const ret: SkillDetail[] = []
    // 因为可能会有技能空缺，先将无任何效果的技能放入6个位置
    for (let i = 0; i < 6; ++i) {
      ret.push({
        scoreUp: 0,
        lifeRecovery: 0
      })
    }
    // 将C位重复技能以外的技能分配到合适的位置
    for (let i = 0; i < skills.length - 1; ++i) {
      ret[i] = skills[i]
    }
    // 将C位重复技能固定放在最后
    ret[5] = skills[skills.length - 1]
    return ret
  }

  /**
   * 计算Live详情
   * @param deckCards 用户卡组中的用户卡牌
   * @param musicMeta 歌曲信息
   * @param liveType Live类型
   * @param liveSkills 技能顺序（多人或最佳留空）
   */
  public async getLiveDetail (
    deckCards: UserCard[], musicMeta: MusicMeta, liveType: LiveType,
    liveSkills: LiveSkill[] | undefined = undefined
  ): Promise<LiveDetail> {
    const deckDetail = await this.deckCalculator.getDeckDetail(deckCards)
    // 如果给定了顺序就按顺序发动，没有的话就按最优发动
    const skills = liveType === LiveType.MULTI
      ? undefined
      : LiveCalculator.getSoloLiveSkill(liveSkills, deckDetail.skill)
    return LiveCalculator.getLiveDetailByDeck(deckDetail, musicMeta, liveType, skills)
  }

  /**
   * 获取卡组Live分数
   * @param deckCards 卡组
   * @param honorBonus 称号加成
   * @param musicMeta 歌曲信息
   * @param liveType Live类型
   */
  public static getLiveScoreByDeck (
    deckCards: CardDetail[], honorBonus: number, musicMeta: MusicMeta, liveType: LiveType
  ): number {
    return LiveCalculator.getLiveDetailByDeck(
      DeckCalculator.getDeckDetailByCards(deckCards, honorBonus), musicMeta, liveType).score
  }
}

export interface LiveDetail {
  score: number
  time: number
  life: number
  tap: number
}

export interface LiveSkill {
  seq?: number
  cardId: number
}

export enum LiveType {
  SOLO = 'solo',
  AUTO = 'auto',
  CHALLENGE = 'challenge',
  MULTI = 'multi',
  CHEERFUL = 'cheerful',
}
