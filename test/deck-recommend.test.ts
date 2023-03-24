import { ChallengeLiveDeckRecommend } from '../src/deck-recommend/challenge-live-deck-recommend'
import { TestDataProvider } from './data-provider.test'
import { type UserCard } from '../src/user-data/user-card'
import { type UserArea } from '../src/user-data/user-area'

const challengeRecommend = new ChallengeLiveDeckRecommend(TestDataProvider.INSTANCE)

/**
 * 调整用户数据，拉满各项指标
 */
async function maxUser (): Promise<void> {
  const userCards = await TestDataProvider.INSTANCE.getUserData('userCards') as UserCard[]
  userCards.forEach(it => {
    it.masterRank = 5
    it.skillLevel = 4
  })

  const userAreas = await TestDataProvider.INSTANCE.getUserData('userAreas') as UserArea[]
  userAreas.forEach(area => { area.areaItems.forEach(it => { it.level = 15 }) })
}
test('challenge', async () => {
  await maxUser()
  await challengeRecommend.recommendChallengeLiveDeck(24, 62, 'master').then(it => {
    console.log(it)
    expect(it.score).toBe(2371140)
  })
})
