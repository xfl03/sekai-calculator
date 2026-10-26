import { TestDataProvider } from './data-provider.test'
import { DeckCalculator, DeckService } from '../src'

const deckService = new DeckService(TestDataProvider.INSTANCE)
const deckCalculator = new DeckCalculator(TestDataProvider.INSTANCE)

// 主数据每天都会更新，所以这里不再写死综合力/技能的绝对值（会随数据漂移），
// 改为校验「总综合力 = 各卡综合力之和 + 称号加成」这类不变量
test('deck', async () => {
  const deck = await deckService.getDeckCards(await deckService.getDeck(1))
  const honorBonus = await deckCalculator.getHonorBonusPower()
  const detail = await deckCalculator.getDeckDetail(deck, deck)

  // 卡组顺序、张数与用户卡组一致
  expect(detail.cards.map(it => it.cardId)).toEqual(deck.map(it => it.cardId))

  // 总综合力 = 各卡综合力之和 + 称号加成
  const powerSum = detail.cards.reduce((v, it) => v + it.power.total, 0)
  expect(detail.power.total).toBe(powerSum + honorBonus)
  expect(detail.power.total).toBeGreaterThan(0)
  // 各单项综合力之和也要对得上总综合力
  expect(detail.power.total).toBe(
    detail.power.base + detail.power.areaItemBonus + detail.power.characterBonus +
    detail.power.fixtureBonus + detail.power.gateBonus + detail.power.honorBonus)

  for (const card of detail.cards) {
    // 单卡综合力 = 基础 + 区域道具 + 角色等级 + 家具 + 大门
    expect(card.power.total).toBe(
      card.power.base + card.power.areaItemBonus + card.power.characterBonus +
      card.power.fixtureBonus + card.power.gateBonus)
    expect(card.power.base).toBeGreaterThan(0)
    // 技能必须取到有效值（不写死具体百分比，避免随主数据/平衡性调整变化）
    expect(card.skill.scoreUp).toBeGreaterThan(0)
    expect(card.skill.lifeRecovery).toBeGreaterThanOrEqual(0)
  }
})
