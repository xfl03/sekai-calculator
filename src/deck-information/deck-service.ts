import { type DataProvider } from '../common/data-provider'
import { type UserDeck } from '../user-data/user-deck'
import { findOrThrow } from '../util/collection-util'
import { type UserCard } from '../user-data/user-card'
import { type UserChallengeLiveSoloDeck } from '../user-data/user-challenge-live-solo-deck'
import { type CardDetail } from './card-calculator'

export class DeckService {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获取用户卡牌
   * @param cardId 卡牌ID
   */
  public async getUserCard (cardId: number): Promise<UserCard> {
    const userCards = await this.dataProvider.getUserData('userCards') as UserCard[]
    return findOrThrow(userCards, it => it.cardId === cardId)
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
    const cardIds = [userDeck.member1, userDeck.member2, userDeck.member3, userDeck.member4, userDeck.member5]
    return await Promise.all(cardIds.map(async id => await this.getUserCard(id)))
  }

  /**
   * 给定卡牌组建新的用户卡组
   * @param userCards 卡牌（5张）
   * @param userId 玩家ID
   * @param deckId 卡组ID
   * @param name 卡组名称
   */
  public static toUserDeck (userCards: CardDetail[], userId: number = 1145141919810, deckId: number = 1, name: string = 'ユニット01'): UserDeck {
    if (userCards.length !== 5) throw new Error('deck card should be 5')
    return {
      userId,
      deckId,
      name,
      leader: userCards[0].cardId,
      subLeader: userCards[1].cardId,
      member1: userCards[0].cardId,
      member2: userCards[1].cardId,
      member3: userCards[2].cardId,
      member4: userCards[3].cardId,
      member5: userCards[4].cardId
    }
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
    const cardIds = [deck.leader, deck.support1, deck.support2, deck.support3, deck.support4]
    return await Promise.all(cardIds.filter(it => it !== undefined && it !== null)
      .map(async id => await this.getUserCard(id === null ? 0 : id)))
  }

  /**
   * 给定卡牌组建新的用户挑战卡组
   * @param userCards 卡牌（最少2张）
   * @param characterId 角色ID
   */
  public static toUserChallengeLiveSoloDeck (userCards: CardDetail[], characterId: number): UserChallengeLiveSoloDeck {
    if (userCards.length < 2) throw new Error('deck card should more than 1')
    return {
      characterId,
      leader: userCards[0].cardId,
      support1: userCards[1].cardId,
      support2: userCards.length < 3 ? null : userCards[2].cardId,
      support3: userCards.length < 4 ? null : userCards[3].cardId,
      support4: userCards.length < 5 ? null : userCards[4].cardId
    }
  }
}
