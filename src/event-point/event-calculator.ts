import type { DataProvider } from '../common/data-provider'
import type { UserDeck } from '../user-data/user-deck'
import { DeckCalculator } from '../card-deck/deck-calculator'
import { CardEventCalculator } from './card-event-calculator'

export class EventCalculator {
  private readonly deckCalculator: DeckCalculator
  private readonly cardEventCalculator: CardEventCalculator
  public constructor (private readonly dataProvider: DataProvider) {
    this.deckCalculator = new DeckCalculator(dataProvider)
    this.cardEventCalculator = new CardEventCalculator(dataProvider)
  }

  /**
   * 计算用户卡组的活动加成
   * @param userDeck 用户卡组
   * @param eventId 活动ID
   */
  public async getDeckEventBonus (userDeck: UserDeck, eventId: number): Promise<number> {
    const deckCards = await this.deckCalculator.getDeckCards(userDeck)
    return await deckCards.reduce(async (v, it) =>
      await v + await this.cardEventCalculator.getCardEventBonus(it, eventId), Promise.resolve(0))
  }

  /**
   * 计算用户卡组的活动加成
   * @param deckId 用户卡组ID
   * @param eventId 活动ID
   */
  public async getDeckEventBonusById (deckId: number, eventId: number): Promise<number> {
    return await this.getDeckEventBonus(await this.deckCalculator.getDeck(deckId), eventId)
  }
}
