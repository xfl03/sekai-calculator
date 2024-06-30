import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { findOrThrow } from '../util/collection-util'
import { type Skill } from '../master-data/skill'
import { CardDetailMap } from './card-detail-map'
import { type DeckCardSkillDetail } from '../deck-information/deck-calculator'
import type { UserCharacter } from '../user-data/user-character'

export class CardSkillCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获得不同情况下的卡牌技能
   * @param userCard 用户卡牌
   * @param card 卡牌
   */
  public async getCardSkill (userCard: UserCard, card: Card):
  Promise<CardDetailMap<DeckCardSkillDetail>> {
    const skillMap = new CardDetailMap<DeckCardSkillDetail>()
    const detail = await this.getSkillDetail(userCard, card)
    if (detail.scoreUpEnhance !== undefined) {
      // 组合相关，处理不同人数的情况
      for (let i = 1; i <= 5; ++i) {
        // 如果全部同队还有一次额外加成
        const scoreUp = detail.scoreUp + (i === 5 ? 5 : (i - 1)) * detail.scoreUpEnhance.value
        skillMap.set(detail.scoreUpEnhance.unit, i, 1, scoreUp, {
          scoreUp,
          lifeRecovery: detail.lifeRecovery
        })
      }
    }
    // 固定加成，即便是组分也有个保底加成
    skillMap.set('any', 1, 1, detail.scoreUp, {
      scoreUp: detail.scoreUp,
      lifeRecovery: detail.lifeRecovery
    })
    return skillMap
  }

  /**
   * 获取卡牌技能
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @private
   */
  private async getSkillDetail (userCard: UserCard, card: Card): Promise<SkillDetail> {
    const skill = await this.getSkill(userCard, card)
    const ret: SkillDetail = { scoreUp: 0, lifeRecovery: 0 }
    // 新FES卡用的角色等级加成
    const characterRank = await this.getCharacterRank(card.characterId)
    let characterRankBonus = 0

    for (const skillEffect of skill.skillEffects) {
      const skillEffectDetail = findOrThrow(skillEffect.skillEffectDetails, it => it.level === userCard.skillLevel)
      if (skillEffect.skillEffectType === 'score_up' ||
        skillEffect.skillEffectType === 'score_up_condition_life' ||
        skillEffect.skillEffectType === 'score_up_keep') {
        // 计算一般分卡
        const current = skillEffectDetail.activateEffectValue
        // 组分特殊计算
        // 目前只有组分会用skillEnhance，新FES不用
        if (skillEffect.skillEnhance !== undefined) {
          ret.scoreUpEnhance = {
            unit: skillEffect.skillEnhance.skillEnhanceCondition.unit,
            value: skillEffect.skillEnhance.activateEffectValue
          }
        }
        // 通过取max的方式，可以直接拿到判分、血分最高加成
        ret.scoreUp = Math.max(ret.scoreUp, current)
      } else if (skillEffect.skillEffectType === 'life_recovery') {
        // 计算奶卡
        ret.lifeRecovery += skillEffectDetail.activateEffectValue
      } else if (skillEffect.skillEffectType === 'score_up_character_rank') {
        // 计算新FES卡，角色等级额外加成
        if (skillEffect.activateCharacterRank !== undefined && skillEffect.activateCharacterRank <= characterRank) {
          characterRankBonus = Math.max(characterRankBonus, skillEffectDetail.activateEffectValue)
        }
      }
      // TODO 新FES卡觉醒前只能说根本没法算，有待支持
    }
    // 新FES卡角色等级额外加成
    ret.scoreUp += characterRankBonus
    return ret
  }

  /**
   * 获得技能（会根据当前选择的觉醒状态）
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @private
   */
  private async getSkill (userCard: UserCard, card: Card): Promise<Skill> {
    let skillId = card.skillId
    // 有觉醒后特殊技能且当前选择的是觉醒后
    if (card.specialTrainingSkillId !== undefined && userCard.defaultImage === 'special_training') {
      skillId = card.specialTrainingSkillId
    }

    const skills = await this.dataProvider.getMasterData<Skill>('skills')
    return findOrThrow(skills, it => it.id === skillId)
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
}

interface SkillDetail {
  scoreUp: number
  scoreUpEnhance?: { unit: string, value: number }
  lifeRecovery: number
}
