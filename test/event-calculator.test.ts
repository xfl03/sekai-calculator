import { EventCalculator } from '../src'
import { TestDataProvider } from './data-provider.test'

const dataProvider = TestDataProvider.INSTANCE
const instance = new EventCalculator(dataProvider)
// 同属性同角色四星、当期卡、5破
test('50+20+15', async () => {
  await instance.getCardEventBonus({
    cardId: 606,
    masterRank: 5,
    episodes: [],
    level: 1,
    skillLevel: 1
  }, 88).then(it => {
    expect(it).toBe(85)
  })
}, 10000)

// 同属性无支援组合V家四星、非当期卡、0破
test('40+0+0', async () => {
  await instance.getCardEventBonus({
    cardId: 337,
    masterRank: 0,
    episodes: [],
    level: 1,
    skillLevel: 1
  }, 88).then(it => {
    expect(it).toBe(40)
  })
})

// 选一个卡组算加成，按mock的数据应该是275%加成
test('deck', async () => {
  await instance.getDeckEventBonusById(1, 88).then(it => {
    expect(it).toBe(275)
  })
})
