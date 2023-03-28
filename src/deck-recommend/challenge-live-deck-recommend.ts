import { type DataProvider } from '../common/data-provider'
import { type UserChallengeLiveSoloDeck } from '../user-data/user-challenge-live-solo-deck'
import { findOrThrow } from '../util/collection-util'
import { DeckService } from '../deck-information/deck-service'
import { BaseDeckRecommend } from './base-deck-recommend'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { LiveType } from '../live-score/live-calculator'
import { type MusicMeta } from '../common/music-meta'

export class ChallengeLiveDeckRecommend {
  private readonly baseRecommend: BaseDeckRecommend

  public constructor (private readonly dataProvider: DataProvider) {
    this.baseRecommend = new BaseDeckRecommend(dataProvider)
  }

  /**
   * 推荐挑战Live用的卡牌
   * 根据Live分数高低推荐
   * @param characterId 角色ID
   * @param musicMeta 歌曲信息
   * @param member 限制人数（2-5、默认5）
   */
  public async recommendChallengeLiveDeck (
    characterId: number, musicMeta: MusicMeta, member: number = 5
  ): Promise<{ score: number, deck: UserChallengeLiveSoloDeck }> {
    const userCards = await this.dataProvider.getUserData('userCards') as UserCard[]
    const cards = await this.dataProvider.getMasterData('cards') as Card[]
    const characterCards = userCards
      .filter(userCard => findOrThrow(cards, it => it.id === userCard.cardId).characterId === characterId)
    const recommend = await this.baseRecommend.recommendHighScoreDeck(characterCards, musicMeta,
      BaseDeckRecommend.getLiveScoreFunction(LiveType.SOLO), 0, true, member)
    return {
      score: recommend.score,
      deck: DeckService.toUserChallengeLiveSoloDeck(recommend.deckCards, characterId)
    }
  }
}
