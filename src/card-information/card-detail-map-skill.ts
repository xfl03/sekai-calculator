import { CardDetailMap } from './card-detail-map'
import type { DeckCardSkillDetailPrepare } from './card-skill-calculator'

export class CardDetailMapSkill extends CardDetailMap<DeckCardSkillDetailPrepare> {
  private fixedSkill?: DeckCardSkillDetailPrepare = undefined
  /**
   * 设定与其他成员完全无关的固定数值技能（保底技能）
   * @param value 设定的值
   */
  public setFixedSkill (value: DeckCardSkillDetailPrepare): void {
    super.set('any', 1, 1, value.scoreUpFixed, value)
    this.fixedSkill = value
  }

  /**
   * Bloom FES原创觉醒前：吸技能
   * @param value 设定的值
   */
  public setReferenceSkill (value: DeckCardSkillDetailPrepare): void {
    if (value.scoreUpReference === undefined) {
      throw new Error('scoreUpReference is not defined')
    }
    // 最小可能值为吸10%技能
    super.updateMinMax(value.scoreUpReference.base + Math.floor(10 * value.scoreUpReference.rate / 100))
    super.set('any', 1, 1, value.scoreUpReference.max, value)
    this.fixedSkill = value
  }

  /**
   * V家限定：根据组合人数确定技能效果
   * @param unit 特定卡牌组合（虚拟歌手卡牌可能存在两个组合）
   * @param unitMember 该组合对应的人数（1~5人）
   * @param value 设定的值
   */
  public setSameUnitSkill (unit: string, unitMember: number, value: DeckCardSkillDetailPrepare): void {
    super.set(unit, unitMember, 1, value.scoreUpFixed, value)
    this.fixedSkill = undefined
  }

  /**
   * Bloom Fes V家觉醒前：根据不同组合数量确定技能效果
   * @param unitMember 不同组合的数量（1~2个）
   * @param value 设定的值
   */
  public setDiffUnitSkill (unitMember: number, value: DeckCardSkillDetailPrepare): void {
    this.setSameUnitSkill('diff', unitMember, value)
  }

  /**
   * 获取给定情况下的技能
   * 会返回最合适的值，如果给定的条件与卡牌完全不符会给出异常
   * @param unit 特定卡牌组合（虚拟歌手卡牌可能存在两个组合）
   * @param unitMember 该组合对应的人数（真实值）
   */
  public getSkill (unit: string, unitMember: number): DeckCardSkillDetailPrepare {
    // 如果当前只有固定技能，返回固定技能
    if (this.fixedSkill !== undefined) {
      return this.fixedSkill
    }
    // 与当前组合相关的技能
    let best = this.getInternal(unit, unitMember, 1)
    if (best !== undefined) {
      return best
    }
    // 有可能是混组技能，被优化成了1或2
    if (unit === 'diff') {
      best = this.getInternal('diff', Math.min(2, unitMember), 1)
      if (best !== undefined) {
        return best
      }
    }
    // 有可能因为技能是固定数值，attrMember、unitMember都优化成1了，组合直接为any
    // 約定：不管是哪种技能，都需要设置any 1 1，不然deck-calculator取技能的时候会报错
    best = this.getInternal('any', 1, 1)
    if (best !== undefined) {
      return best
    }
    // 如果这还找不到，说明给的情况就不对
    throw new Error('case not found')
  }
}
