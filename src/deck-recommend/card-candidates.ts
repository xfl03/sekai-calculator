import type { CardDetail } from '../card-information/card-calculator'
import { computeWithDefault } from '../util/collection-util'

/**
 * 搜索候选的筛选工具
 * 这些方法只用于「挑哪些卡进递归」，不参与实际计分
 */
export class CardCandidates {
  /**
   * 卡牌属性的种类数量
   * Finale 至少需要 3 种属性，按属性补齐时要用到
   */
  public static readonly ATTR_COUNT = 5

  /**
   * 用于筛选卡牌强弱的数值
   * 活动加成优先，其次是综合力，最后是技能
   * @param card 卡牌
   */
  public static getValue (card: CardDetail): number {
    const eventBonus = card.eventBonus?.getMaxBonus(true) ?? 0
    return eventBonus * 1000000 + card.power.getMaxValue() * 10 + card.skill.getMaxValue()
  }

  /**
   * 按给定分组保留每组最强的若干张卡牌
   * 加成相近时同一组内的卡牌只有综合力、技能不同，
   * 不先收窄数量的话优先级筛选会放出上百张卡牌，导致递归遍历爆炸
   * @param cards 卡牌
   * @param limit 每组保留的数量
   * @param keyFunc 分组用的key
   */
  public static reduce (cards: CardDetail[], limit: number, keyFunc: (card: CardDetail) => string): CardDetail[] {
    const map = new Map<string, CardDetail[]>()
    cards.forEach(it => {
      computeWithDefault(map, keyFunc(it), [] as CardDetail[], array => {
        array.push(it)
        return array
      })
    })
    const ret: CardDetail[] = []
    for (const group of map.values()) {
      group.sort((a, b) => CardCandidates.getValue(b) - CardCandidates.getValue(a))
      ret.push(...group.slice(0, limit))
    }
    return ret
  }

  /**
   * 每个角色每种属性只保留最强的若干张卡牌
   * @param cards 卡牌
   * @param limit 每组保留的数量
   */
  public static perCharacterAndAttr (cards: CardDetail[], limit: number): CardDetail[] {
    return CardCandidates.reduce(cards, limit, it => `${it.characterId}-${it.attr}`)
  }

  /**
   * 每个角色只保留最强的若干张卡牌
   * @param cards 卡牌
   * @param limit 每人保留的数量
   */
  public static perCharacter (cards: CardDetail[], limit: number): CardDetail[] {
    return CardCandidates.reduce(cards, limit, it => it.characterId.toString())
  }

  /**
   * 把候选卡牌压到指定数量
   * 按活动加成、综合力、技能从高到低保留，再补齐缺失的属性和角色：
   * 只按强弱截断的话，加成集中在少数角色时会把候选全填成那几个角色的卡，
   * 凑不出 5 个不同角色，属性也可能不够（World Link 至少需要 3 种属性）
   * @param cards 候选卡牌
   * @param limit 数量上限
   * @param member 需要凑齐的角色数（0 表示不检查）
   */
  public static top (cards: CardDetail[], limit: number, member: number = 0): CardDetail[] {
    if (cards.length <= limit) return cards
    const sorted = [...cards].sort((a, b) => CardCandidates.getValue(b) - CardCandidates.getValue(a))
    const ret = sorted.slice(0, limit)
    const attrs = new Set(ret.map(it => it.attr))
    const characters = new Set(ret.map(it => it.characterId))
    for (const card of sorted.slice(limit)) {
      if (attrs.size >= CardCandidates.ATTR_COUNT && characters.size >= member) break
      if (attrs.has(card.attr) && characters.has(card.characterId)) continue
      attrs.add(card.attr)
      characters.add(card.characterId)
      ret.push(card)
    }
    return ret
  }

  /**
   * 判断卡池能否组出同色卡组（每个属性至少有 member 个不同角色）
   * @param cards 卡牌
   * @param member 人数限制
   */
  public static canMakeAttrDeck (cards: CardDetail[], member: number): boolean {
    const map = new Map<string, Set<number>>()
    cards.forEach(it => {
      computeWithDefault(map, it.attr, new Set<number>(), set => {
        set.add(it.characterId)
        return set
      })
    })
    for (const set of map.values()) {
      if (set.size >= member) return true
    }
    return false
  }
}
