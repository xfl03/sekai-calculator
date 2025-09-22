import {
  ChallengeLiveDeckRecommend,
  DeckCalculator,
  DeckService,
  EventCalculator,
  EventDeckRecommend,
  EventType,
  EventService,
  LiveCalculator,
  LiveType,
  type UserArea,
  type UserCard, BloomSupportDeckRecommend
} from '../src'
import { TestDataProvider } from './data-provider.test'
import { safeNumber } from '../src/util/number-util'

const challengeRecommend = new ChallengeLiveDeckRecommend(TestDataProvider.INSTANCE)
const eventRecommend = new EventDeckRecommend(TestDataProvider.INSTANCE)
const liveCalculator = new LiveCalculator(TestDataProvider.INSTANCE)
const deckCalculator = new DeckCalculator(TestDataProvider.INSTANCE)
const deckService = new DeckService(TestDataProvider.INSTANCE)
const eventService = new EventService(TestDataProvider.INSTANCE)

/**
 * 调整用户数据，拉满各项指标
 */
export async function maxUser (): Promise<void> {
  const userCards = await TestDataProvider.INSTANCE.getUserData<UserCard[]>('userCards')
  userCards.forEach(it => {
    it.masterRank = 5
    it.skillLevel = 4
  })

  const userAreas = await TestDataProvider.INSTANCE.getUserData<UserArea[]>('userAreas')
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
    // debugLog: (str) => { console.log(`Challenge: ${str}`) }
  }).then(it => {
    // console.log(it)
    expect(it[0].score).toBeGreaterThanOrEqual(score)
    const deck = DeckService.toUserChallengeLiveSoloDeck(it[0].cards, 24)
    expect(deck.leader).toBe(it[0].cards[0].cardId)
  })
})
test('event', async () => {
  // await maxUser()
  const musicMeta = await liveCalculator.getMusicMeta(74, 'master')
  const cards = await deckService.getDeckCards({
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
  })
  const deckDetail = await deckCalculator.getDeckDetail(cards, cards, await eventService.getEventConfig(89))
  const score = EventCalculator.getDeckEventPoint(deckDetail, musicMeta, LiveType.MULTI, EventType.MARATHON)
  // console.log(`Current score:${score}`)
  const recommend0 = await eventRecommend.recommendEventDeck(89, LiveType.MULTI, {
    musicMeta,
    limit: 1
    // debugLog: (str) => { console.log(`Event0: ${str}`) }
  })
  // console.log(recommend0[0].deckCards)
  expect(recommend0[0].score).toBeGreaterThanOrEqual(score)

  const deck = DeckService.toUserDeck(recommend0[0].cards)
  expect(deck.leader).toBe(recommend0[0].cards[0].cardId)

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
    // debugLog: (str) => { console.log(`Event1: ${str}`) }
  })
  // console.log(recommend1)
  expect(recommend1[0].score).toBeGreaterThanOrEqual(recommend0[0].score)
})

const bloomSupportRecommend = new BloomSupportDeckRecommend(TestDataProvider.INSTANCE)

test('bloom', async () => {
  const musicMeta = await liveCalculator.getMusicMeta(74, 'master')
  const recommend0 = await eventRecommend.recommendEventDeck(112, LiveType.MULTI, {
    musicMeta,
    limit: 10,
    debugLog: (str) => {
      console.log(`Bloom: ${str}`)
    }
  }, 18)
  console.log(recommend0.map(it => `${it.eventBonus !== undefined ? it.eventBonus : '0'}+${it.supportDeckBonus !== undefined ? it.supportDeckBonus : '0'} -> ${it.score}`))
  expect(recommend0.length).toBeGreaterThanOrEqual(1)
  expect(recommend0[0].supportDeckBonus).toBeGreaterThanOrEqual(1)

  const recommend1 = await bloomSupportRecommend.recommendBloomSupportDeck(recommend0[0].cards, 112, 18)
  // console.log(recommend1.map(it => it.supportDeckBonus))
  expect(recommend1.reduce((a, it) => a + safeNumber(it.supportDeckBonus), 0)).toBe(recommend0[0].supportDeckBonus)
})
