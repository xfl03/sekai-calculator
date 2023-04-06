import { TestDataProvider } from './data-provider.test'
import { DeckCalculator, DeckService } from '../src'

const deckService = new DeckService(TestDataProvider.INSTANCE)
const deckCalculator = new DeckCalculator(TestDataProvider.INSTANCE)
// 选一个卡组算数据，测试数据是263805综合、[80,80,100,40,40]加分、[0,0,0,0,250]回复
test('deck', async () => {
  const scoreUp = [80, 80, 100, 40, 40]
  const lifeRecovery = [0, 0, 0, 0, 250]
  const deck = await deckService.getDeckCards(await deckService.getDeck(1))
  await deckCalculator.getDeckDetail(deck).then(it => {
    expect(it.power).toBe(263805)
    it.cards.forEach((it, i) => {
      expect(it.scoreUp).toBe(scoreUp[i])
      expect(it.lifeRecovery).toBe(lifeRecovery[i])
    })
  })
})
