import { type DataProvider } from '../common/data-provider'
import { DeckCalculator, type DeckDetail, type SkillDetail } from '../card-deck/deck-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { duplicateObj, findOrThrow, mapOrUndefined } from '../util/collection-util'

export class LiveCalculator {
  private readonly deckCalculator: DeckCalculator
  public constructor (private readonly dataProvider: DataProvider) {
    this.deckCalculator = new DeckCalculator(dataProvider)
  }

  /**
   * 获得基础分数
   * @param musicMeta 歌曲数据
   * @param liveType Live类型
   * @private
   */
  private getBaseScore (musicMeta: MusicMeta, liveType: LiveType): number {
    switch (liveType) {
      case LiveType.SOLO:
        return musicMeta.base_score
      case LiveType.MULTI:
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
  private getSkillScore (musicMeta: MusicMeta, liveType: LiveType): number[] {
    switch (liveType) {
      case LiveType.SOLO:
        return musicMeta.skill_score_solo
      case LiveType.MULTI:
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
   * @param skillDetails 技能顺序（小于5后面技能留空、如果是多人需要放入加权后的累加值），如果留空则计算最佳技能
   * @param multiPowerSum 多人队伍综合力总和（用于计算活跃加成，留空则使用5倍当前卡组综合力）
   */
  public async getLiveDetailByDeck (
    deckDetail: DeckDetail, musicMeta: MusicMeta, liveType: LiveType,
    skillDetails: SkillDetail[] | undefined = undefined, multiPowerSum: number = 0
  ): Promise<LiveDetail> {
    // 确定技能发动顺序，未指定则直接按效果排序
    const bestSkill = skillDetails === undefined
    const skills = bestSkill
      ? [...deckDetail.skill, deckDetail.skill[0]].sort((a, b) => a.scoreUp - b.scoreUp)
      : skillDetails
    // 与技能无关的分数比例
    const baseRate = this.getBaseScore(musicMeta, liveType)
    // 技能分数比例，如果是最佳技能计算则按加成排序（复制一下防止影响原数组顺序）
    const skillRate = bestSkill
      ? [...this.getSkillScore(musicMeta, liveType)].sort((a, b) => a - b)
      : this.getSkillScore(musicMeta, liveType)
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
  private getMultiLiveSkill (deckDetail: DeckDetail): SkillDetail {
    // 多人技能加分效果计算规则：C位100%发动、其他位置20%发动
    const scoreUp = deckDetail.skill.reduce((v, it, i) =>
      v + (i === 0 ? it.scoreUp : (it.scoreUp / 5)), 0)
    // 奶判只看C位
    const lifeRecovery = deckDetail.skill[0].lifeRecovery
    return { scoreUp, lifeRecovery }
  }

  /**
   * 计算Live详情
   * @param deckCards 用户卡组中的用户卡牌
   * @param musicId 歌曲ID
   * @param musicDiff 歌曲难度
   * @param liveType Live类型
   * @param liveSkills 技能顺序（多人或最佳留空）
   */
  public async getLiveDetail (
    deckCards: UserCard[], musicId: number, musicDiff: string, liveType: LiveType,
    liveSkills: LiveSkill[] | undefined = undefined
  ): Promise<LiveDetail> {
    const musicMetas = await this.dataProvider.getMusicMeta() as MusicMeta[]
    const musicMeta = findOrThrow(musicMetas, it => it.music_id === musicId && it.difficulty === musicDiff)
    const deckDetail = await this.deckCalculator.getDeckDetail(deckCards)
    // 如果给定了顺序就按顺序发动，没有的话就重复6次当前卡组的多人技能效果
    const skills = liveType === LiveType.MULTI
      ? duplicateObj(this.getMultiLiveSkill(deckDetail), 6)
      : (mapOrUndefined(liveSkills, liveSkill => findOrThrow(deckDetail.skill, it => it.cardId === liveSkill.cardId)))
    return await this.getLiveDetailByDeck(deckDetail, musicMeta, liveType, skills)
  }

  /**
   * 计算Live详情
   * @param deckId 卡组ID
   * @param musicId 歌曲ID
   * @param musicDiff 歌曲难度
   * @param liveType Live类型
   * @param liveSkills 技能顺序（多人或最佳留空）
   */
  public async getLiveDetailById (
    deckId: number, musicId: number, musicDiff: string, liveType: LiveType,
    liveSkills: LiveSkill[] | undefined = undefined
  ): Promise<LiveDetail> {
    return await this.getLiveDetail(
      await this.deckCalculator.getDeckCardsById(deckId), musicId, musicDiff, liveType, liveSkills)
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
  MULTI = 'multi',
  AUTO = 'auto'
}
