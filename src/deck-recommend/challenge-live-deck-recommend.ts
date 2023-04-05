import { type DataProvider } from '../data-provider/data-provider'
import { findOrThrow } from '../util/collection-util'
import { BaseDeckRecommend, type DeckRecommendConfig, type RecommendDeck } from './base-deck-recommend'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { LiveType } from '../live-score/live-calculator'

export class ChallengeLiveDeckRecommend {
  private readonly baseRecommend: BaseDeckRecommend

  public constructor (private readonly dataProvider: DataProvider) {
    this.baseRecommend = new BaseDeckRecommend(dataProvider)
  }

  /**
   * 推荐挑战Live用的卡牌
   * 根据Live分数高低推荐
   * @param characterId 角色ID
   * @param config 推荐设置
   */
  public async recommendChallengeLiveDeck (
    characterId: number, config: DeckRecommendConfig
  ): Promise<RecommendDeck[]> {
    const userCards = await this.dataProvider.getUserData('userCards') as UserCard[]
    const cards = await this.dataProvider.getMasterData('cards') as Card[]
    const characterCards = userCards
      .filter(userCard => findOrThrow(cards, it => it.id === userCard.cardId).characterId === characterId)
    return await this.baseRecommend.recommendHighScoreDeck(characterCards,
      BaseDeckRecommend.getLiveScoreFunction(LiveType.SOLO), config, 0, true)
  }
}
