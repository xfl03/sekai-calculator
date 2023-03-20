import { TestDataProvider } from './data-provider.test'
import { DeckCalculator } from '../src/card-deck/deck-calculator'

const instance = new DeckCalculator(TestDataProvider.INSTANCE)
test('get deck cards by id', async () => {
  await instance.getDeckCardsById(1).then(it => {
    expect(it.length).toBe(5)
  })
})
// 选一个卡组算数据，测试数据是263805综合、[80,80,100,40,40]加分、[0,0,0,0,250]回复
test('deck', async () => {
  const scoreUp = [80, 80, 100, 40, 40]
  const lifeRecovery = [0, 0, 0, 0, 250]
  await instance.getDeckDetailById(1).then(it => {
    expect(it.power).toBe(263805)
    it.skill.forEach((it, i) => {
      expect(it.scoreUp).toBe(scoreUp[i])
      expect(it.lifeRecovery).toBe(lifeRecovery[i])
    })
  })
})
