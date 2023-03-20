import { TestDataProvider } from './data-provider.test'
import { EventCalculator, DeckService, CardEventCalculator } from '../src'

const eventCalculator = new EventCalculator(TestDataProvider.INSTANCE)
const cardEventCalculator = new CardEventCalculator(TestDataProvider.INSTANCE)
const deckService = new DeckService(TestDataProvider.INSTANCE)
// 同属性同角色四星、当期卡、5破
test('50+20+15', async () => {
  await cardEventCalculator.getCardEventBonus({
    cardId: 606,
    masterRank: 5,
    episodes: [],
    level: 1,
    skillLevel: 1
  }, 88).then(it => {
    expect(it).toBe(85)
  })
})

// 同属性无支援组合V家四星、非当期卡、0破
test('40+0+0', async () => {
  await cardEventCalculator.getCardEventBonus({
    cardId: 337,
    masterRank: 0,
    episodes: [],
    level: 1,
    skillLevel: 1
  }, 88).then(it => {
    expect(it).toBe(40)
  })
}, 10000)

// 选一个卡组算加成，按mock的数据应该是275%加成
test('deck', async () => {
  const deck = await deckService.getDeckCards(await deckService.getDeck(1))
  await eventCalculator.getDeckEventBonus(deck, 88).then(it => {
    expect(it).toBe(275)
  })
})
