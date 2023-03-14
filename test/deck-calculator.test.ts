import { TestDataProvider } from './data-provider.test'
import { DeckCalculator } from '../src/card-deck/deck-calculator'

const instance = new DeckCalculator(TestDataProvider.INSTANCE)
test('get deck cards by id', async () => {
  await instance.getDeckCardsById(1).then(it => {
    expect(it.length).toBe(5)
  })
})
