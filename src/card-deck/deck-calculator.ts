import type { DataProvider } from '../common/data-provider'
import type { UserCard } from '../user-data/user-card'
import type { UserDeck } from '../user-data/user-deck'
import { findOrThrow } from '../util/array-util'

export class DeckCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  public async getDeck (deckId: number): Promise<UserDeck> {
    const userDecks = await this.dataProvider.getUserData('userDecks') as UserDeck[]
    return findOrThrow(userDecks, it => it.deckId === deckId)
  }

  public async getDeckCards (userDeck: UserDeck): Promise<UserCard[]> {
    const userCards = await this.dataProvider.getUserData('userCards') as UserCard[]
    const cardIds = [userDeck.member1, userDeck.member2, userDeck.member3, userDeck.member4, userDeck.member5]
    return cardIds.map(id => findOrThrow(userCards, it => it.cardId === id))
  }

  public async getDeckCardsById (deckId: number): Promise<UserCard[]> {
    return await this.getDeckCards(await this.getDeck(deckId))
  }
}
