import { TestDataProvider } from './data-provider.test'
import { CardEventCalculator, DeckService, EventCalculator, EventLiveType } from '../src'

const eventCalculator = new EventCalculator(TestDataProvider.INSTANCE)
const cardEventCalculator = new CardEventCalculator(TestDataProvider.INSTANCE)
const deckService = new DeckService(TestDataProvider.INSTANCE)
// 选一张卡算加成，15+15
test('card', async () => {
  await cardEventCalculator.getCardEventBonus(await deckService.getUserCard(510), 88).then(it => {
    expect(it).toBe(30)
  })
})

// 选一个卡组算加成，按mock的数据应该是275%加成
test('deck', async () => {
  const deck = await deckService.getDeckCards(await deckService.getDeck(1))
  await eventCalculator.getDeckEventBonus(deck, 88).then(it => {
    expect(it).toBe(275)
  })
})

test('challenge point', () => {
  const point = EventCalculator.getEventPoint(EventLiveType.CHALLENGE, 1919810)
  expect(point).toBe(23400)
})

test('multi point', () => {
  expect(EventCalculator.getEventPoint(
    EventLiveType.MULTI, 2499999, 100, 260, 15, 8888888)).toBe(14580)
  expect(EventCalculator.getEventPoint(
    EventLiveType.MULTI, 1907777, 100, 125, 15, 8888888)).toBe(7920)
  expect(EventCalculator.getEventPoint(
    EventLiveType.MULTI, 2302222, 100, 315, 10, 8888888)).toBe(10700)
  expect(EventCalculator.getEventPoint(
    EventLiveType.MULTI, 2070000, 100, 285, 23, 8888888)).toBe(21597)
  expect(EventCalculator.getEventPoint(
    EventLiveType.MULTI, 2061111, 100, 271, 10, 8888888)).toBe(9050)
})
