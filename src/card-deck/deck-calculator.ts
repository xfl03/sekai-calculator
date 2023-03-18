import type { DataProvider } from '../common/data-provider'
import type { UserCard } from '../user-data/user-card'
import type { UserDeck } from '../user-data/user-deck'
import { findOrThrow } from '../util/array-util'
import { type UserHonor } from '../user-data/user-honor'
import { type Honor } from '../master-data/honor'

export class DeckCalculator {
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
   * 根据卡组ID获得用户卡组中的用户卡牌
   * @param deckId 用户卡组ID
   */
  public async getDeckCardsById (deckId: number): Promise<UserCard[]> {
    return await this.getDeckCards(await this.getDeck(deckId))
  }

  /**
   * 获取称号的综合力加成（与卡牌无关、根据称号累加）
   */
  public async getHonorBonusPower (): Promise<number> {
    const honors = await this.dataProvider.getMasterData('honors') as Honor[]
    const userHonors = await this.dataProvider.getUserData('userHonors') as UserHonor[]
    return userHonors
      .map(userHonor => {
        const honor = findOrThrow(honors, it => it.id === userHonor.level)
        return findOrThrow(honor.levels, it => it.level === userHonor.level)
      })
      .reduce((v, it) => v + it.bonus, 0)
  }
}
