import { type CardDetail } from '../deck-information/card-calculator'
import { computeWithDefault } from '../util/collection-util'

/**
 * 卡牌稀有度，一定要按priority从小到大排序，priority从0开始即可
 */
const cardPriorities = [
  {
    eventBonus: 25 + 25 + 20 + 25, // 同色同队 当期卡 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 0
  }, {
    eventBonus: 25 + 25 + 20 + 10, // 同色同队 当期卡 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 10
  }, {
    eventBonus: 25 + 25 + 25, // 同色同队 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 10
  }, {
    eventBonus: 25 + 15 + 25, // 同色同队（V家） 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 30
  }, {
    eventBonus: 25 + 25 + 10, // 同色同队 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 40
  }, {
    eventBonus: 25 + 25, // 同色或同队 5破四星
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 40
  }, {
    eventBonus: 25 + 25 + 15,
    cardRarityType: 'rarity_birthday',
    masterRank: 5,
    priority: 40
  }, {
    eventBonus: 25 + 15 + 10, // 同色同队（V家） 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 50
  }, {
    eventBonus: 25 + 25 + 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 50
  }, {
    eventBonus: 25 + 25 + 5,
    cardRarityType: 'rarity_3',
    masterRank: 5,
    priority: 50
  }, {
    eventBonus: 25 + 10, // 同色或同队 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 60
  }, {
    eventBonus: 25 + 15,
    cardRarityType: 'rarity_birthday',
    masterRank: 5,
    priority: 60
  }, {
    eventBonus: 25 + 25,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 60
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_4',
    masterRank: 5,
    priority: 60
  }, {
    eventBonus: 15 + 10,
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 25 + 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 25 + 5,
    cardRarityType: 'rarity_3',
    masterRank: 5,
    priority: 70
  }, {
    eventBonus: 25 + 25,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 25 + 25,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 15 + 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 10,
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 90
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 100
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 100
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 100
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
  for (const cardPriority of cardPriorities) {
    // 检查是否已经是符合优先级条件的完整卡组
    if (cardPriority.priority > prePriority && canMakeDeck(cards)) {
      return {
        cardDetails: cards,
        priority: cardPriority.priority
      }
    }
    // 追加符合优先级限制的卡牌
    // 要保证不添加额外的重复卡牌
    const filtered = cardDetails
      .filter(it => cards.find(a => a.cardId === it.cardId) === undefined &&
        it.cardRarityType === cardPriority.cardRarityType &&
        it.masterRank >= cardPriority.masterRank &&
        (it.eventBonus !== undefined && it.eventBonus >= cardPriority.eventBonus))
    cards = [...cards, ...filtered]
  }
  // 所有优先级已经结束，直接返回全部卡牌
  return {
    cardDetails,
    priority: getMaxPriority()
  }
}

/**
 * 获取最大优先级
 */
export function getMaxPriority (): number {
  return cardPriorities[cardPriorities.length - 1].priority
}
