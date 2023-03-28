import { type DataProvider } from '../common/data-provider'
import { DeckService } from '../deck-information/deck-service'
import { BaseDeckRecommend } from './base-deck-recommend'
import { type UserCard } from '../user-data/user-card'
import { type LiveType } from '../live-score/live-calculator'
import { type UserDeck } from '../user-data/user-deck'
import { type MusicMeta } from '../common/music-meta'

export class EventDeckRecommend {
  private readonly baseRecommend: BaseDeckRecommend

  public constructor (private readonly dataProvider: DataProvider) {
    this.baseRecommend = new BaseDeckRecommend(dataProvider)
  }

  /**
   * 推荐活动用的卡牌
   * 根据活动PT高低推荐
   * @param eventId 活动ID
   * @param musicMeta 歌曲信息
   * @param liveType Live类型
   */
  public async recommendEventDeck (
    eventId: number, musicMeta: MusicMeta, liveType: LiveType
  ): Promise<{ point: number, deck: UserDeck }> {
    const userCards = await this.dataProvider.getUserData('userCards') as UserCard[]
    const recommend = await this.baseRecommend.recommendHighScoreDeck(userCards, musicMeta,
      BaseDeckRecommend.getEventPointFunction(liveType), eventId)
    return {
      point: recommend.score,
      deck: DeckService.toUserDeck(recommend.deckCards)
    }
  }
}
