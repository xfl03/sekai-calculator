import { type CardDetail } from '../deck-information/card-calculator'
import { computeWithDefault } from '../util/collection-util'

const cardPriorities = [
  {
    eventBonus: 60,
    cardRarityType: 'rarity_4',
    priority: 0
  }, {
    eventBonus: 55,
    cardRarityType: 'rarity_birthday',
    priority: 0
  }, {
    eventBonus: 50,
    cardRarityType: 'rarity_4',
    priority: 1
  }, {
    eventBonus: 50,
    cardRarityType: 'rarity_birthday',
    priority: 1
  }, {
    eventBonus: 40,
    cardRarityType: 'rarity_4',
    priority: 2
  }, {
    eventBonus: 50,
    cardRarityType: 'rarity_3',
    priority: 2
  }, {
    eventBonus: 35,
    cardRarityType: 'rarity_birthday',
    priority: 3
  }, {
    eventBonus: 50,
    cardRarityType: 'rarity_2',
    priority: 3
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_4',
    priority: 4
  }, {
    eventBonus: 50,
    cardRarityType: 'rarity_1',
    priority: 4
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_birthday',
    priority: 5
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_3',
    priority: 5
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_2',
    priority: 6
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_1',
    priority: 6
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_4',
    priority: 7
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_birthday',
    priority: 7
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_3',
    priority: 8
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_2',
    priority: 9
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_1',
    priority: 10
  }
]

/**
 * 判断某属性或者组合角色数量至少5个
 * @param cardDetails 卡牌
 */
function canMakeDeck (cardDetails: CardDetail[]): boolean {
  // 统计组合或者属性的不同角色出现次数
  const map = new Map<string, Set<number>>()
  for (const cardDetail of cardDetails) {
    computeWithDefault(map, cardDetail.attr, new Set(), it => it.add(cardDetail.characterId))
    for (const unit of cardDetail.units) {
      computeWithDefault(map, unit, new Set(), it => it.add(cardDetail.characterId))
    }
  }
  // 如果有任何一个大于等于5，就没问题
  for (const v of map.values()) {
    if (v.size >= 5) return true
  }
  return false
}

/**
 * 根据给定优先级过滤卡牌
 * @param cardDetails 卡牌
 * @param prePriority 上一次的优先级，保证返回优先级大于它
 */
export function filterCardPriority (
  cardDetails: CardDetail[], prePriority: number = 0
): { cardDetails: CardDetail[], priority: number } {
  let cards: CardDetail[] = []
  let latestPriority = 0
  for (const cardPriority of cardPriorities) {
    // 检查是否已经是符合优先级条件的完整卡组
    if (cardPriority.priority > latestPriority && latestPriority > prePriority && canMakeDeck(cards)) {
      return {
        cardDetails: cards,
        priority: cardPriority.priority - 1
      }
    }
    // 追加符合优先级限制的卡牌
    const filtered = cardDetails
      .filter(it => it.cardRarityType === cardPriority.cardRarityType &&
        (it.eventBonus === undefined || it.eventBonus >= cardPriority.eventBonus))
    cards = [...cards, ...filtered]
    latestPriority = cardPriority.priority
  }
  // 所有优先级已经结束
  return {
    cardDetails: cards,
    priority: latestPriority
  }
}
