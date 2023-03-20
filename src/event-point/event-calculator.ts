import type { DataProvider } from '../common/data-provider'
import { CardEventCalculator } from './card-event-calculator'
import { type UserCard } from '../user-data/user-card'

export class EventCalculator {
  private readonly cardEventCalculator: CardEventCalculator
  public constructor (private readonly dataProvider: DataProvider) {
    this.cardEventCalculator = new CardEventCalculator(dataProvider)
  }

  /**
   * 计算用户卡组的活动加成
   * @param deckCards 用户卡组中的卡牌
   * @param eventId 活动ID
   */
  public async getDeckEventBonus (deckCards: UserCard[], eventId: number): Promise<number> {
    return await deckCards.reduce(async (v, it) =>
      await v + await this.cardEventCalculator.getCardEventBonus(it, eventId), Promise.resolve(0))
  }
}
