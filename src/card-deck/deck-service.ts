import { type DataProvider } from '../common/data-provider'
import { type UserDeck } from '../user-data/user-deck'
import { findOrThrow } from '../util/collection-util'
import { type UserCard } from '../user-data/user-card'
import { type UserChallengeLiveSoloDeck } from '../user-data/user-challenge-live-solo-deck'

export class DeckService {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 通过卡组ID获取用户卡组
   * @param deckId 用户卡组ID
   */
  public async getDeck (deckId: number): Promise<UserDeck> {
    const userDecks = await this.dataProvider.getUserData('userDecks') as UserDeck[]
    return findOrThrow(userDecks, it => it.deckId === deckId)
  }

  /**
   * 获得用户卡组中的用户卡牌
   * @param userDeck 用户卡组
   */
  public async getDeckCards (userDeck: UserDeck): Promise<UserCard[]> {
    const userCards = await this.dataProvider.getUserData('userCards') as UserCard[]
    const cardIds = [userDeck.member1, userDeck.member2, userDeck.member3, userDeck.member4, userDeck.member5]
    return cardIds.map(id => findOrThrow(userCards, it => it.cardId === id))
  }

  /**
   * 通过角色ID获取挑战Live卡组
   * @param characterId 角色ID
   */
  public async getChallengeLiveSoloDeck (characterId: number): Promise<UserChallengeLiveSoloDeck> {
    const userChallengeLiveSoloDecks =
      await this.dataProvider.getUserData('userChallengeLiveSoloDecks') as UserChallengeLiveSoloDeck[]
    return findOrThrow(userChallengeLiveSoloDecks, it => it.characterId === characterId)
  }

  /**
   * 获取用户挑战Live卡组中的卡牌
   * @param deck 挑战Live卡组
   */
  public async getChallengeLiveSoloDeckCards (deck: UserChallengeLiveSoloDeck): Promise<UserCard[]> {
    const userCards = await this.dataProvider.getUserData('userCards') as UserCard[]
    const cardIds = [deck.leader, deck.support1, deck.support2, deck.support3, deck.support4]
    return cardIds.filter(it => it !== undefined && it !== null)
      .map(id => findOrThrow(userCards, it => it.cardId === id))
  }
}
