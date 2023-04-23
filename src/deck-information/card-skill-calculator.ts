import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { findOrThrow } from '../util/collection-util'
import { type Skill } from '../master-data/skill'
import { CardDetailMap } from './card-detail-map'

export class CardSkillCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获得不同情况下的卡牌技能
   * @param userCard 用户卡牌
   * @param card 卡牌
   */
  public async getCardSkill (userCard: UserCard, card: Card):
  Promise<{ scoreUp: CardDetailMap, lifeRecovery: number }> {
    const scoreUpMap = new CardDetailMap()
    const detail = await this.getSkillDetail(userCard, card)
    if (detail.scoreUpEnhance !== undefined) {
      // 组合相关，处理不同人数的情况
      for (let i = 1; i <= 5; ++i) {
        // 如果全部同队还有一次额外加成
        const scoreUp = detail.scoreUp + (i === 5 ? 5 : (i - 1)) * detail.scoreUpEnhance.value
        scoreUpMap.set(detail.scoreUpEnhance.unit, i, 1, scoreUp)
      }
    }
    // 固定加成，即便是组分也有个保底加成
    scoreUpMap.set('any', 1, 1, detail.scoreUp)
    return { scoreUp: scoreUpMap, lifeRecovery: detail.lifeRecovery }
  }

  /**
   * 获取卡牌技能
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @private
   */
  private async getSkillDetail (userCard: UserCard, card: Card): Promise<SkillDetail> {
    const skills = await this.dataProvider.getMasterData<Skill>('skills')
    const skill = findOrThrow(skills, it => it.id === card.skillId)
    const ret: SkillDetail = { scoreUp: 0, lifeRecovery: 0 }
    for (const skillEffect of skill.skillEffects) {
      const skillEffectDetail = findOrThrow(skillEffect.skillEffectDetails, it => it.level === userCard.skillLevel)
      if (skillEffect.skillEffectType === 'score_up' ||
        skillEffect.skillEffectType === 'score_up_condition_life' ||
        skillEffect.skillEffectType === 'score_up_keep') {
        // 计算一般分卡
        const current = skillEffectDetail.activateEffectValue
        // 组分特殊计算
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
      }
    }
    return ret
  }
}

interface SkillDetail {
  scoreUp: number
  scoreUpEnhance?: { unit: string, value: number }
  lifeRecovery: number
}
