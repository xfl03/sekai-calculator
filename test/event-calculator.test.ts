import EventCalculator from '../src/event-point/event-calculator'
import { getTestDataProvider } from './data-provider.test'

const instance = new EventCalculator(getTestDataProvider())
// 同属性同角色四星、当期卡、5破
test('50+20+15', async () => {
  await instance.getCardEventBonus({
    cardId: 606,
    masterRank: 5
  }, 88).then(it => {
    expect(it).toBe(85)
  })
})

// 同属性无支援组合V家四星、非当期卡、0破
test('40+0+0', async () => {
  await instance.getCardEventBonus({
    cardId: 337,
    masterRank: 0
  }, 88).then(it => {
    expect(it).toBe(40)
  })
})
