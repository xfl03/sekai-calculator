import { type CardPriority } from './card-priority-filter'

/**
 * 卡牌稀有度顺序，用于世界开花
 */
export const bloomCardPriorities: CardPriority[] = [
  {
    eventBonus: 25 + 10, // 同队 0破四星
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 0
  }, {
    eventBonus: 25 + 5, // 同队 0破生日
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 0
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 10
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 20
  }, {
    eventBonus: 25,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 30
  }, {
    eventBonus: 10,
    cardRarityType: 'rarity_4',
    masterRank: 0,
    priority: 60
  }, {
    eventBonus: 5,
    cardRarityType: 'rarity_birthday',
    masterRank: 0,
    priority: 70
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_3',
    masterRank: 0,
    priority: 80
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_2',
    masterRank: 0,
    priority: 90
  }, {
    eventBonus: 0,
    cardRarityType: 'rarity_1',
    masterRank: 0,
    priority: 100
  }
]
