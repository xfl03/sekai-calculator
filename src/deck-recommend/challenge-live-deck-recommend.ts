import { type DataProvider } from '../data-provider/data-provider'
import { type UserChallengeLiveSoloDeck } from '../user-data/user-challenge-live-solo-deck'
import { findOrThrow } from '../util/collection-util'
import { DeckService } from '../deck-information/deck-service'
import { BaseDeckRecommend, type DeckRecommendConfig } from './base-deck-recommend'
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
  ): Promise<Array<{ score: number, power: number, deck: UserChallengeLiveSoloDeck }>> {
    const userCards = await this.dataProvider.getUserData('userCards') as UserCard[]
    const cards = await this.dataProvider.getMasterData('cards') as Card[]
    const characterCards = userCards
      .filter(userCard => findOrThrow(cards, it => it.id === userCard.cardId).characterId === characterId)
    const recommend = await this.baseRecommend.recommendHighScoreDeck(characterCards,
      BaseDeckRecommend.getLiveScoreFunction(LiveType.SOLO), config, 0, true)
    return recommend.map(it => {
      return {
        score: it.score,
        power: it.power,
        deck: DeckService.toUserChallengeLiveSoloDeck(it.deckCards, characterId)
      }
    })
  }
}
