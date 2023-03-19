import { TestDataProvider } from './data-provider.test'
import { EventCalculator } from '../src'
import { CardEventCalculator } from '../src/event-point/card-event-calculator'

const dataProvider = TestDataProvider.INSTANCE
const eventCalculator = new EventCalculator(dataProvider)
const cardEventCalculator = new CardEventCalculator(dataProvider)
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
  await eventCalculator.getDeckEventBonusById(1, 88).then(it => {
    expect(it).toBe(275)
  })
})
