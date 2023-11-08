import { type DataProvider } from '../data-provider/data-provider'
import { type UserDeck } from '../user-data/user-deck'
import { findOrThrow } from '../util/collection-util'
import { type UserCard } from '../user-data/user-card'
import { type UserChallengeLiveSoloDeck } from '../user-data/user-challenge-live-solo-deck'
import { type DeckCardDetail } from './deck-calculator'
import { type UserWorldBloomSupportDeck } from '../user-data/user-world-bloom-support-deck'
import { type CardDetail } from '../card-information/card-calculator'

export class DeckService {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获取用户卡牌
   * @param cardId 卡牌ID
   */
  public async getUserCard (cardId: number): Promise<UserCard> {
    const userCards = await this.dataProvider.getUserData<UserCard[]>('userCards')
    return findOrThrow(userCards, it => it.cardId === cardId)
  }

  /**
   * 通过卡组ID获取用户卡组
   * @param deckId 用户卡组ID
   */
  public async getDeck (deckId: number): Promise<UserDeck> {
    const userDecks = await this.dataProvider.getUserData<UserDeck[]>('userDecks')
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
  public static toUserDeck (userCards: DeckCardDetail[], userId: number = 1145141919810, deckId: number = 1, name: string = 'ユニット01'): UserDeck {
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
      await this.dataProvider.getUserData<UserChallengeLiveSoloDeck[]>('userChallengeLiveSoloDecks')
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
   * @param userCards 卡牌（2～5张）
   * @param characterId 角色ID
   */
  public static toUserChallengeLiveSoloDeck (userCards: DeckCardDetail[], characterId: number): UserChallengeLiveSoloDeck {
    if (userCards.length < 1) throw new Error('deck card should >= 1')
    if (userCards.length > 5) throw new Error('deck card should <= 5')
    return {
      characterId,
      leader: userCards[0].cardId,
      support1: userCards.length < 2 ? null : userCards[1].cardId,
      support2: userCards.length < 3 ? null : userCards[2].cardId,
      support3: userCards.length < 4 ? null : userCards[3].cardId,
      support4: userCards.length < 5 ? null : userCards[4].cardId
    }
  }

  /**
   * 给定卡牌组建新的用户世界连接应援卡组
   * @param userCards 卡牌（0～12张）
   * @param gameCharacterId 角色ID
   */
  public static toUserWorldBloomSupportDeck (userCards: CardDetail[], gameCharacterId: number): UserWorldBloomSupportDeck {
    if (userCards.length > 12) throw new Error('deck card should <= 12')
    return {
      gameCharacterId,
      member1: userCards.length < 1 ? null : userCards[0].cardId,
      member2: userCards.length < 2 ? null : userCards[1].cardId,
      member3: userCards.length < 3 ? null : userCards[2].cardId,
      member4: userCards.length < 4 ? null : userCards[3].cardId,
      member5: userCards.length < 5 ? null : userCards[4].cardId,
      member6: userCards.length < 6 ? null : userCards[5].cardId,
      member7: userCards.length < 7 ? null : userCards[6].cardId,
      member8: userCards.length < 8 ? null : userCards[7].cardId,
      member9: userCards.length < 9 ? null : userCards[8].cardId,
      member10: userCards.length < 10 ? null : userCards[9].cardId,
      member11: userCards.length < 11 ? null : userCards[10].cardId,
      member12: userCards.length < 12 ? null : userCards[11].cardId
    }
  }
}
