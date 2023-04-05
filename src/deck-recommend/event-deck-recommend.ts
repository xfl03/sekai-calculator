import { type DataProvider } from '../data-provider/data-provider'
import { DeckService } from '../deck-information/deck-service'
import { BaseDeckRecommend, type DeckRecommendConfig } from './base-deck-recommend'
import { type UserCard } from '../user-data/user-card'
import { type LiveType } from '../live-score/live-calculator'
import { type UserDeck } from '../user-data/user-deck'

export class EventDeckRecommend {
  private readonly baseRecommend: BaseDeckRecommend

  public constructor (private readonly dataProvider: DataProvider) {
    this.baseRecommend = new BaseDeckRecommend(dataProvider)
  }

  /**
   * 推荐活动用的卡牌
   * 根据活动PT高低推荐
   * @param eventId 活动ID
   * @param liveType Live类型
   * @param config 推荐设置
   */
  public async recommendEventDeck (
    eventId: number, liveType: LiveType, config: DeckRecommendConfig
  ): Promise<Array<{ point: number, power: number, eventBonus?: number, deck: UserDeck }>> {
    const userCards = await this.dataProvider.getUserData('userCards') as UserCard[]
    const recommend = await this.baseRecommend.recommendHighScoreDeck(userCards,
      BaseDeckRecommend.getEventPointFunction(liveType), config, eventId)
    return recommend.map(it => {
      return {
        point: it.score,
        power: it.power,
        eventBonus: it.eventBonus,
        deck: DeckService.toUserDeck(it.deckCards)
      }
    })
  }
}
