import { ChallengeLiveDeckRecommend, EventDeckRecommend, CardCalculator, DeckCalculator, DeckService, EventCalculator, LiveCalculator, LiveType } from '../src'
import { TestDataProvider } from './data-provider.test'
import { type UserCard } from '../src/user-data/user-card'
import { type UserArea } from '../src/user-data/user-area'

const challengeRecommend = new ChallengeLiveDeckRecommend(TestDataProvider.INSTANCE)
const eventRecommend = new EventDeckRecommend(TestDataProvider.INSTANCE)
const liveCalculator = new LiveCalculator(TestDataProvider.INSTANCE)
const deckCalculator = new DeckCalculator(TestDataProvider.INSTANCE)
const deckService = new DeckService(TestDataProvider.INSTANCE)
const cardCalculator = new CardCalculator(TestDataProvider.INSTANCE)

/**
 * 调整用户数据，拉满各项指标
 */
export async function maxUser (): Promise<void> {
  const userCards = await TestDataProvider.INSTANCE.getUserData('userCards') as UserCard[]
  userCards.forEach(it => {
    it.masterRank = 5
    it.skillLevel = 4
  })

  const userAreas = await TestDataProvider.INSTANCE.getUserData('userAreas') as UserArea[]
  userAreas.forEach(area => {
    area.areaItems.forEach(it => {
      it.level = 15
    })
  })
}

test('challenge', async () => {
  // await maxUser()
  const deck = await deckService.getChallengeLiveSoloDeckCards({
    characterId: 24,
    leader: 510,
    support1: 151,
    support2: 238,
    support3: 271,
    support4: 406
  })
  const liveDetail = await liveCalculator.getLiveDetail(
    deck, await liveCalculator.getMusicMeta(104, 'master'), LiveType.SOLO)
  const score = liveDetail.score
  console.log(`Current score:${score}`)
  await challengeRecommend.recommendChallengeLiveDeck(24, 104, 'master').then(it => {
    console.log(it)
    expect(it.score).toBeGreaterThanOrEqual(score)
  })
})
test('event', async () => {
  const musicMeta = await liveCalculator.getMusicMeta(74, 'master')
  const cardDetails = await cardCalculator.batchGetCardDetail(await deckService.getDeckCards({
    userId: 1145141919810,
    deckId: 1,
    name: 'ユニット01',
    leader: 510,
    subLeader: 87,
    member1: 510,
    member2: 87,
    member3: 196,
    member4: 152,
    member5: 219
  }), 89)
  const score = EventCalculator.getDeckEventPoint(
    cardDetails, await deckCalculator.getHonorBonusPower(), musicMeta, LiveType.MULTI)
  console.log(`Current score:${score}`)
  // await maxUser()
  await eventRecommend.recommendEventDeck(89, 74, 'master', LiveType.MULTI).then(it => {
    console.log(it)
    expect(it.point).toBeGreaterThanOrEqual(score)
  })
})
