import {
  ChallengeLiveDeckRecommend,
  type Card,
  DeckCalculator,
  DeckService,
  EventCalculator,
  EventDeckRecommend,
  EventType,
  EventService,
  type EventDeckBonus,
  type GameCharacter,
  type GameCharacterUnit,
  LiveCalculator,
  LiveType,
  type RecommendDeck,
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

/**
 * 推荐出来的卡组必须合法：5 张不同角色（World Link 还要求至少 3 种属性）
 * @param deck 推荐结果
 * @param minAttrs 属性种类下限（World Link 是 3，其他活动没有限制）
 */
async function expectLegalDeck (deck: RecommendDeck, minAttrs: number = 1): Promise<void> {
  const masterCards = await TestDataProvider.INSTANCE.getMasterData<Card>('cards')
  const cardById = new Map(masterCards.map(it => [it.id, it]))
  const getCard = (cardId: number): Card => {
    const card = cardById.get(cardId)
    if (card === undefined) throw new Error(`Card ${cardId} not found in master data`)
    return card
  }
  const cards = deck.cards.map(it => getCard(it.cardId))
  expect(cards.length).toBe(5)
  expect(new Set(cards.map(it => it.id)).size).toBe(5)
  expect(new Set(cards.map(it => it.characterId)).size).toBe(5)
  expect(new Set(cards.map(it => it.attr)).size).toBeGreaterThanOrEqual(minAttrs)
}

/**
 * 活动加成对应的角色（eventDeckBonuses 里出现的角色）
 * @param eventId 活动ID
 */
async function getEventBonusCharacters (eventId: number): Promise<Set<number>> {
  const eventDeckBonuses =
    await TestDataProvider.INSTANCE.getMasterData<EventDeckBonus>('eventDeckBonuses')
  const gameCharacterUnits =
    await TestDataProvider.INSTANCE.getMasterData<GameCharacterUnit>('gameCharacterUnits')
  const characterIdByUnitId = new Map(gameCharacterUnits.map(it => [it.id, it.gameCharacterId]))
  return new Set(eventDeckBonuses
    .filter(it => it.eventId === eventId && it.gameCharacterUnitId !== undefined)
    .map(it => characterIdByUnitId.get(it.gameCharacterUnitId as number) as number))
}

test('world link finale', async () => {
  // 218 是 World Link Finale：主卡组全角色可用，只有应援卡组跟 C 位组合走，
  // 活动加成只与角色有关（每张卡 5%、当期卡 25%、C 位再 20%）
  const leaderCharacterId = 1
  const eventConfig = await eventService.getEventConfig(218, leaderCharacterId)
  expect(eventConfig.worldBloomType).toBe('finale')
  expect(eventConfig.eventUnit).toBeUndefined()
  expect(eventConfig.attrIndependentBonus).toBe(false)

  const masterCards = await TestDataProvider.INSTANCE.getMasterData<Card>('cards')
  const cardById = new Map(masterCards.map(it => [it.id, it]))
  const musicMeta = await liveCalculator.getMusicMeta(74, 'master')
  const start = Date.now()
  const recommend = await eventRecommend.recommendEventDeck(218, LiveType.MULTI, {
    musicMeta,
    limit: 10
  }, leaderCharacterId)
  const elapsed = Date.now() - start

  // 没有属性/组合剪枝可用，必须靠候选收窄保证不会退化成全量枚举
  expect(elapsed).toBeLessThan(30000)
  expect(recommend.length).toBeGreaterThan(0)
  for (const deck of recommend) {
    await expectLegalDeck(deck, 3)
  }
  // C 位固定为指定角色
  expect(cardById.get(recommend[0].cards[0].cardId)?.characterId).toBe(leaderCharacterId)
  // 主卡组不再限制在 C 位组合：至少有一套推荐卡组混用了不同组合
  const gameCharacters = await TestDataProvider.INSTANCE.getMasterData<GameCharacter>('gameCharacters')
  const unitById = new Map(gameCharacters.map(it => [it.id, it.unit]))
  const unitsInDecks = recommend.map(deck =>
    new Set(deck.cards.map(it => unitById.get(cardById.get(it.cardId)?.characterId as number))).size)
  expect(Math.max(...unitsInDecks)).toBeGreaterThan(1)
})

test('world link chapter', async () => {
  // 214 是混合 World Link 的章节：主线角色跨 5 个组合，
  // 主卡组全角色可用（只有对象角色有加成），应援卡组跟 C 位组合走
  const leaderCharacterId = 11
  const eventConfig = await eventService.getEventConfig(214, leaderCharacterId)
  expect(eventConfig.worldBloomType).toBe('game_character')
  // 混合 WL 的加成角色跨组合，所以推导不出单一活动组合
  expect(eventConfig.eventUnit).toBeUndefined()
  const bonusCharacters = await getEventBonusCharacters(214)
  expect(bonusCharacters.size).toBeGreaterThan(4)

  const masterCards = await TestDataProvider.INSTANCE.getMasterData<Card>('cards')
  const cardById = new Map(masterCards.map(it => [it.id, it]))
  const musicMeta = await liveCalculator.getMusicMeta(74, 'master')
  const start = Date.now()
  const recommend = await eventRecommend.recommendEventDeck(214, LiveType.MULTI, {
    musicMeta,
    limit: 5
  }, leaderCharacterId)
  expect(Date.now() - start).toBeLessThan(30000)
  expect(recommend.length).toBeGreaterThan(0)
  for (const deck of recommend) {
    await expectLegalDeck(deck, 3)
  }
  // 加成对象角色占多数（否则说明把主卡组锁死在某个组合里了）
  const topCards = recommend[0].cards.map(it => cardById.get(it.cardId)?.characterId as number)
  expect(topCards.filter(it => bonusCharacters.has(it)).length).toBeGreaterThanOrEqual(3)
})

test('memories', async () => {
  // 222 是加成与属性无关的活动（每角色对所有颜色都是 75%），组卡走同色 + 混色双搜索
  const eventConfig = await eventService.getEventConfig(222)
  expect(eventConfig.attrIndependentBonus).toBe(true)
  expect(eventConfig.eventType).toBe(EventType.MARATHON)

  const musicMeta = await liveCalculator.getMusicMeta(74, 'master')
  const start = Date.now()
  const recommend = await eventRecommend.recommendEventDeck(222, LiveType.MULTI, {
    musicMeta,
    limit: 5
  })
  expect(Date.now() - start).toBeLessThan(30000)
  expect(recommend.length).toBeGreaterThan(0)
  for (const deck of recommend) {
    await expectLegalDeck(deck)
  }
})
