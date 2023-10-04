import { type CardDetail } from '../deck-information/card-calculator'
import { computeWithDefault } from '../util/collection-util'

const cardPriorities = [
  {
    eventBonus: 25 + 25 + 20 + 25, // 同色同队 当期卡 5破四星
    cardRarityType: 'rarity_4',
    priority: 0
  }, {
    eventBonus: 25 + 25 + 20 + 10, // 同色同队 当期卡 0破四星
    cardRarityType: 'rarity_4',
    priority: 10
  }, {
    eventBonus: 25 + 25 + 25, // 同色同队 5破四星
    cardRarityType: 'rarity_4',
    priority: 20
  }, {
    eventBonus: 25 + 15 + 25, // 同色同队（V家） 5破四星
    cardRarityType: 'rarity_4',
    priority: 30
  }, {
    eventBonus: 25 + 25 + 10, // 同色同队 0破四星
    cardRarityType: 'rarity_4',
    priority: 40
  }, {
    eventBonus: 25 + 25 + 15,
    cardRarityType: 'rarity_birthday',
    priority: 40
  }, {
    eventBonus: 25 + 15 + 10, // 同色同队（V家） 0破四星、同色或同队 5破四星
    cardRarityType: 'rarity_4',
    priority: 50
  }, {
    eventBonus: 25 + 25 + 5,
    cardRarityType: 'rarity_birthday',
    priority: 50
  }, {
    eventBonus: 25 + 25 + 5,
    cardRarityType: 'rarity_3',
    priority: 50
  }, {
    eventBonus: 25 + 10, // 同色或同队 0破四星
    cardRarityType: 'rarity_4',
    priority: 60
  }, {
    eventBonus: 25 + 15,
    cardRarityType: 'rarity_birthday',
    priority: 60
  }, {
    eventBonus: 25 + 25,
    cardRarityType: 'rarity_3',
    priority: 60
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_4',
    priority: 70
  }, {
    eventBonus: 25 + 5,
    cardRarityType: 'rarity_birthday',
    priority: 70
  }, {
    eventBonus: 25 + 5,
    cardRarityType: 'rarity_3',
    priority: 70
  }, {
    eventBonus: 50,
    cardRarityType: 'rarity_2',
    priority: 70
  }, {
    eventBonus: 50,
    cardRarityType: 'rarity_1',
    priority: 70
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_birthday',
    priority: 80
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_3',
    priority: 80
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_2',
    priority: 80
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_1',
    priority: 80
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_4',
    priority: 90
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_birthday',
    priority: 90
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_3',
    priority: 90
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_2',
    priority: 90
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_1',
    priority: 90
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
  cardDetails: CardDetail[], prePriority: number = -114514
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
