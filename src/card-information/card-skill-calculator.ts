import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { findOrThrow } from '../util/collection-util'
import { type Skill } from '../master-data/skill'
import type { UserCharacter } from '../user-data/user-character'
import { CardDetailMapSkill } from './card-detail-map-skill'

export class CardSkillCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获得不同情况下的卡牌技能
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param scoreUpLimit World Link Finale卡牌技能限制
   */
  public async getCardSkill (
    userCard: UserCard, card: Card, scoreUpLimit: number = Number.MAX_SAFE_INTEGER
  ): Promise<CardDetailMapSkill> {
    const skillMap = new CardDetailMapSkill()
    const details = await this.getSkillDetails(userCard, card)
    // 获得最大基础加成，用于Bloom FES卡排除觉醒前的一些无意义情况
    let maxScoreUpBasic = details
      .reduce((v, it) =>
        Math.max(v, CardSkillCalculator.getScoreUpSelfFixed(it)), 0)
    maxScoreUpBasic = Math.min(maxScoreUpBasic, scoreUpLimit) // 强制封顶
    const maxLife = details
      .reduce((v, it) => Math.max(v, it.lifeRecovery), 0)
    // 用最大基础加成作为卡牌基础加成参与比较（认为是技能效果最小值，用于回落技能）
    skillMap.setFixedSkill({
      scoreUpFixed: maxScoreUpBasic,
      scoreUpToReference: maxScoreUpBasic,
      lifeRecovery: maxLife
    })
    // 分别计算觉醒前后技能
    details.forEach(it => {
      CardSkillCalculator.updateSkillDetailMap(skillMap, it, maxScoreUpBasic, scoreUpLimit)
    })
    return skillMap
  }

  /**
   * 填补到卡牌技能详情
   * @param skillMap 卡牌技能详情
   * @param detail 单个技能细节
   * @param maxScoreUpBasic 保底技能
   * @param scoreUpLimit 最高技能限制
   * @private
   */
  private static updateSkillDetailMap (
    skillMap: CardDetailMapSkill,
    detail: SkillDetailInternal, maxScoreUpBasic: number, scoreUpLimit: number
  ): void {
    // 当前技能固定加成
    const scoreUpSelfFixed = CardSkillCalculator.getScoreUpSelfFixed(detail)
    // V家限定组分
    if (detail.scoreUpSameUnit !== undefined) {
      // 组合相关，处理不同人数的情况
      for (let i = 1; i <= 5; ++i) {
        // 如果全部同队还有一次额外加成
        let scoreUpFixed = scoreUpSelfFixed +
            (i === 5 ? 5 : (i - 1)) * detail.scoreUpSameUnit.value
        scoreUpFixed = Math.min(scoreUpFixed, scoreUpLimit) // 强制封顶
        skillMap.setSameUnitSkill(detail.scoreUpSameUnit.unit, i, {
          scoreUpFixed,
          scoreUpToReference: scoreUpFixed,
          lifeRecovery: detail.lifeRecovery
        })
      }
    }
    // Bloom FES 原创觉醒前：吸技能
    if (detail.scoreUpReference !== undefined) {
      let maxValue = scoreUpSelfFixed + detail.scoreUpReference.max
      maxValue = Math.min(maxValue, scoreUpLimit) // 强制封顶
      if (maxValue > maxScoreUpBasic) {
        // 如果比基础加成强，把吸技能更新进基础加成（同时更新技能效果的最大值）
        skillMap.setReferenceSkill({
          scoreUpFixed: maxScoreUpBasic,
          scoreUpToReference: maxValue, // 被吸技能时直接按最大值算
          scoreUpReference: {
            base: scoreUpSelfFixed,
            rate: detail.scoreUpReference.rate,
            max: maxValue
          },
          lifeRecovery: detail.lifeRecovery
        })
      }
    }
    // Bloom FES V家觉醒前：不同组合数量影响技能
    if (detail.scoreUpDifferentUnit !== undefined) {
      for (const [key, value] of detail.scoreUpDifferentUnit) {
        let current = scoreUpSelfFixed + value
        current = Math.min(current, scoreUpSelfFixed) // 强制封顶
        if (current > maxScoreUpBasic) {
          // 只有在高于觉醒后技能的情况下才考虑
          // 不然默认回落到觉醒后技能
          skillMap.setDiffUnitSkill(key, {
            scoreUpFixed: current,
            scoreUpToReference: current,
            lifeRecovery: detail.lifeRecovery
          })
        }
      }
    }
  }

  /**
   * 获取卡牌技能
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @private
   */
  private async getSkillDetails (
    userCard: UserCard, card: Card
  ): Promise<SkillDetailInternal[]> {
    const skills = await this.getSkills(userCard, card)
    // 新FES卡用的角色等级加成
    const characterRank = await this.getCharacterRank(card.characterId)

    return skills.map(it =>
      CardSkillCalculator.getSkillDetail(userCard, it, characterRank))
  }

  /**
   * 获取卡牌单个技能详情
   * @param userCard 用户卡牌
   * @param skill 技能数据
   * @param characterRank 角色等级
   * @private
   */
  private static getSkillDetail (
    userCard: UserCard, skill: Skill, characterRank: number
  ): SkillDetailInternal {
    const ret: SkillDetailInternal = { scoreUpBasic: 0, scoreUpCharacterRank: 0, lifeRecovery: 0 }

    for (const skillEffect of skill.skillEffects) {
      const skillEffectDetail = findOrThrow(skillEffect.skillEffectDetails,
        it => it.level === userCard.skillLevel)
      if (skillEffect.skillEffectType === 'score_up' ||
        skillEffect.skillEffectType === 'score_up_condition_life' ||
        skillEffect.skillEffectType === 'score_up_keep') {
        // 计算一般分卡
        const current = skillEffectDetail.activateEffectValue
        // 组分特殊计算
        // 目前只有组分会用skillEnhance，Bloom FES不用
        if (skillEffect.skillEnhance !== undefined) {
          ret.scoreUpSameUnit = {
            unit: skillEffect.skillEnhance.skillEnhanceCondition.unit,
            value: skillEffect.skillEnhance.activateEffectValue
          }
        }
        // 通过取max的方式，可以直接拿到判分、血分最高加成
        ret.scoreUpBasic = Math.max(ret.scoreUpBasic, current)
      } else if (skillEffect.skillEffectType === 'life_recovery') {
        // 计算奶卡
        ret.lifeRecovery += skillEffectDetail.activateEffectValue
      } else if (skillEffect.skillEffectType === 'score_up_character_rank') {
        // 计算Bloom FES卡觉醒后：角色等级额外加成
        if (skillEffect.activateCharacterRank !== undefined &&
            skillEffect.activateCharacterRank <= characterRank) {
          ret.scoreUpCharacterRank =
              Math.max(ret.scoreUpCharacterRank, skillEffectDetail.activateEffectValue)
        }
      } else if (skillEffect.skillEffectType === 'other_member_score_up_reference_rate') {
        // Bloom FES卡原创角色觉醒前：吸技能
        ret.scoreUpReference = {
          rate: skillEffectDetail.activateEffectValue, max: skillEffectDetail.activateEffectValue2 ?? 0
        }
      } else if (skillEffect.skillEffectType === 'score_up_unit_count') {
        // Bloom FES卡V家觉醒前：根据组合数量确定加成
        if (ret.scoreUpDifferentUnit === undefined) {
          ret.scoreUpDifferentUnit = new Map<number, number>()
        }
        if (skillEffect.activateUnitCount !== undefined) {
          // 不同组合数量决定不同加成
          ret.scoreUpDifferentUnit.set(skillEffect.activateUnitCount, skillEffectDetail.activateEffectValue)
        }
      }
    }
    return ret
  }

  /**
   * 获得技能（会根据当前的觉醒状态）
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @private
   */
  private async getSkills (userCard: UserCard, card: Card): Promise<Skill[]> {
    const skillIds = [card.skillId]
    // 有觉醒后特殊技能且当前已经觉醒
    if (card.specialTrainingSkillId !== undefined && userCard.specialTrainingStatus === 'done') {
      skillIds.push(card.specialTrainingSkillId)
    }

    const skills = await this.dataProvider.getMasterData<Skill>('skills')
    return skills.filter(it => skillIds.includes(it.id))
  }

  /**
   * 获得角色等级
   * @param characterId 角色ID
   * @private
   */
  private async getCharacterRank (characterId: number): Promise<number> {
    const userCharacters = await this.dataProvider.getUserData<UserCharacter[]>('userCharacters')
    const userCharacter =
      findOrThrow(userCharacters, it => it.characterId === characterId)
    return userCharacter.characterRank
  }

  /**
   * 获得固定加成，包括基本加成与新FES觉醒后角色等级加成
   * @param detail 技能
   * @private
   */
  private static getScoreUpSelfFixed (detail: SkillDetailInternal): number {
    return detail.scoreUpBasic + detail.scoreUpCharacterRank
  }
}

interface SkillDetailInternal {
  /**
   * 基础加分（不含下面各种加成）
   */
  scoreUpBasic: number
  /**
   * 回血
   */
  lifeRecovery: number
  /**
   * 限定V家组分：给定组合，指定人数额外加分
   * */
  scoreUpSameUnit?: { unit: string, value: number }
  /**
   * Bloom FES觉醒后：角色等级加成
   */
  scoreUpCharacterRank: number
  /**
   * Bloom FES原创角色觉醒前：吸其他人技能
   * 其中rate为吸技能比例，max为吸技能效果的最大值（不含基础加成）
   */
  scoreUpReference?: { rate: number, max: number }
  /**
   * Bloom FES V家觉醒前：按不同组合数额外加分
   * key：不同组合数（不包括自己，1～2）、value：额外加成
   */
  scoreUpDifferentUnit?: Map<number, number>
}

export interface DeckCardSkillDetailPrepare {
  /**
   * 当前卡组中的固定加分（不含吸技能）
   */
  scoreUpFixed: number
  /**
   * 被吸技能时的效果值（用于吸技能计算）
   */
  scoreUpToReference: number
  /**
   * 新FES原创角色觉醒前：吸其他人技能
   * 其中base为基础分，rate为吸技能比例，max为吸技能效果的最大值（含基础加成）
   * 计算卡组时，并不知道被吸技能的信息（运行时随机），在实际计算分数时再考虑被吸的技能
   */
  scoreUpReference?: { base: number, rate: number, max: number }
  lifeRecovery: number
}
