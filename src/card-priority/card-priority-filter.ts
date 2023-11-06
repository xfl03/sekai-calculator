import { type CardDetail } from '../deck-information/card-calculator'
import { computeWithDefault } from '../util/collection-util'
import { LiveType } from '../live-score/live-calculator'
import { EventType } from '../event-point/event-service'
import { challengeLiveCardPriorities } from './challenge-live-card-priority'
import { bloomCardPriorities } from './bloom-event-card-priority'
import { marathonCheerfulCardPriorities } from './marathon-cheerful-event-card-priority'

/**
 * 判断某属性或者组合角色数量至少5个
 * @param liveType Live类型
 * @param eventType 活动类型
 * @param cardDetails 卡牌
 * @param limit 卡组成员限制
 */
function canMakeDeck (liveType: LiveType, eventType: EventType, cardDetails: CardDetail[], limit: number = 5): boolean {
  // 对于挑战Live来说，只要有卡够就可以组队了
  if (liveType === LiveType.CHALLENGE) return cardDetails.length >= limit
  // 统计组合或者属性的不同角色出现次数
  const attrMap = new Map<string, Set<number>>()
  const unitMap = new Map<string, Set<number>>()
  for (const cardDetail of cardDetails) {
    computeWithDefault(attrMap, cardDetail.attr, new Set(), it => it.add(cardDetail.characterId))
    for (const unit of cardDetail.units) {
      computeWithDefault(unitMap, unit, new Set(), it => it.add(cardDetail.characterId))
    }
  }
  switch (eventType) {
    case EventType.MARATHON:
    case EventType.CHEERFUL:
      // 对于马拉松、欢乐嘉年华活动来说，如果有任何一个大于等于5，就没问题
      for (const v of attrMap.values()) {
        if (v.size >= 5) return true
      }
      for (const v of unitMap.values()) {
        if (v.size >= 5) return true
      }
      return false
    case EventType.BLOOM:
      // 对于世界开花活动，必须要满足能组出5种属性的队伍，且能组出一个团队
      if (attrMap.size < 5) return false// 这样判断比较弱，有可能会让同一人有5种属性、其他人只有1种属性的情况通过
      for (const v of unitMap.values()) {
        if (v.size >= 5) return true
      }
      return false
    default:
      // 未知活动类型，只能先认为无论如何都组不出合理队伍，要求全卡计算
      return false
  }
}

/**
 * 根据给定优先级过滤卡牌
 * @param liveType Live类型
 * @param eventType 活动类型
 * @param cardDetails 卡牌
 * @param preCardDetails 上一次的卡牌，保证返回卡牌数量大于等于它，且能组成队伍
 * @param limit 卡组成员限制
 */
export function filterCardPriority (
  liveType: LiveType, eventType: EventType, cardDetails: CardDetail[], preCardDetails: CardDetail[], limit: number = 5
): CardDetail[] {
  const cardPriorities = getCardPriorities(liveType, eventType)
  let cards: CardDetail[] = []
  let latestPriority = -114514
  const cardIds = new Set<number>()
  for (const cardPriority of cardPriorities) {
    // 检查是否已经是符合优先级条件的完整卡组
    // 因为同一个优先级可能有不止一个情况，所以要等遍历到下个优先级后才能决定是否返回
    if (cardPriority.priority > latestPriority && cards.length > preCardDetails.length && canMakeDeck(liveType, eventType, cards, limit)) {
      return cards
    }
    latestPriority = cardPriority.priority
    // 追加符合优先级限制的卡牌
    // 要保证不添加额外的重复卡牌
    const filtered = cardDetails
      .filter(it => !cardIds.has(it.cardId) &&
        it.cardRarityType === cardPriority.cardRarityType &&
        it.masterRank >= cardPriority.masterRank &&
        (it.eventBonus === undefined || it.eventBonus >= cardPriority.eventBonus))
    filtered.forEach(it => cardIds.add(it.cardId))
    cards = [...cards, ...filtered]
  }
  // 所有优先级已经结束，直接返回全部卡牌
  return cardDetails
}

/**
 * 卡牌优先级
 * 获取到的卡牌优先级需要根据priority从小到大排列
 * @param liveType Live类型
 * @param eventType 活动类型
 */
function getCardPriorities (liveType: LiveType, eventType: EventType): CardPriority[] {
  if (liveType === LiveType.CHALLENGE) return challengeLiveCardPriorities
  if (eventType === EventType.BLOOM) return bloomCardPriorities
  if (eventType === EventType.MARATHON || eventType === EventType.CHEERFUL) return marathonCheerfulCardPriorities
  // 如果都不满足，那就只能都不筛选，所有卡全上
  return [] as CardPriority[]
}

/**
 * 卡牌优先级
 */
export interface CardPriority {
  /**
   * 活动加成下界
   */
  eventBonus: number
  /**
   * 卡牌稀有度
   */
  cardRarityType: string
  /**
   * 突破（专精特训）等级下界
   */
  masterRank: number
  /**
   * 优先级从0开始，优先级越高的数字越低
   */
  priority: number
}
