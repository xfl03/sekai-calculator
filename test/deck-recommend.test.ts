import {
  ChallengeLiveDeckRecommend,
  EventDeckRecommend,
  CardCalculator,
  DeckCalculator,
  DeckService,
  EventCalculator,
  LiveCalculator,
  LiveType
} from '../src'
import { TestDataProvider } from './data-provider.test'
import { type UserCard, type UserArea } from '../src'

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
  const musicMeta = await liveCalculator.getMusicMeta(104, 'master')
  const liveDetail = await liveCalculator.getLiveDetail(deck, musicMeta, LiveType.SOLO)
  const score = liveDetail.score
  // console.log(`Current score:${score}`)
  await challengeRecommend.recommendChallengeLiveDeck(24, {
    musicMeta,
    limit: 1
  }).then(it => {
    // console.log(it)
    expect(it[0].score).toBeGreaterThanOrEqual(score)
    const deck = DeckService.toUserChallengeLiveSoloDeck(it[0].deckCards, 24)
    expect(deck.leader).toBe(it[0].deckCards[0].cardId)
  })
})
test('event', async () => {
  // await maxUser()
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
  }), {}, 89)
  const score = EventCalculator.getDeckEventPoint(
    cardDetails, await deckCalculator.getHonorBonusPower(), musicMeta, LiveType.MULTI)
  // console.log(`Current score:${score}`)
  const recommend0 = await eventRecommend.recommendEventDeck(89, LiveType.MULTI, {
    musicMeta,
    limit: 1
  })
  // console.log(recommend0[0].deckCards)
  expect(recommend0[0].score).toBeGreaterThanOrEqual(score)

  const deck = DeckService.toUserDeck(recommend0[0].deckCards)
  expect(deck.leader).toBe(recommend0[0].deckCards[0].cardId)

  const recommend1 = await eventRecommend.recommendEventDeck(89, LiveType.MULTI, {
    musicMeta,
    limit: 1,
    cardConfig: {
      rarity_1: {
        rankMax: true,
        masterMax: true,
        episodeRead: true,
        skillMax: true
      },
      rarity_2: {
        rankMax: true,
        masterMax: true,
        episodeRead: true,
        skillMax: true
      },
      rarity_3: {
        rankMax: true,
        masterMax: true,
        episodeRead: true,
        skillMax: true
      },
      rarity_birthday: {
        rankMax: true,
        masterMax: false,
        episodeRead: true,
        skillMax: false
      },
      rarity_4: {
        rankMax: true,
        masterMax: false,
        episodeRead: true,
        skillMax: false
      }
    }
  })
  // console.log(recommend1)
  expect(recommend1[0].score).toBeGreaterThanOrEqual(recommend0[0].score)
})
