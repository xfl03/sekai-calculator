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

  /**
   * 计算活动PT
   * @param type Live类型
   * @param selfScore 个人分数
   * @param musicRate 歌曲系数（百分比、挑战Live无用）
   * @param deckBonus 卡组加成（百分比、挑战Live无用）
   * @param boostRate 消耗系数（挑战Live无用）
   * @param otherScore 他人分数（用于多人Live）
   * @param life 剩余血量（用于对战Live）
   */
  public static getEventPoint (
    type: EventLiveType, selfScore: number, musicRate: number = 100, deckBonus: number = 0, boostRate: number = 1,
    otherScore: number = 0, life: number = 1000
  ): number {
    const musicRate0 = musicRate / 100
    const deckRate = deckBonus / 100 + 1
    switch (type) {
      case EventLiveType.SOLO:
        return Math.floor((100 + Math.floor(selfScore / 20000)) * musicRate0 * deckRate) * boostRate
      case EventLiveType.CHALLENGE:
        return (100 + Math.floor(selfScore / 20000)) * 120
      case EventLiveType.MULTI:
        return Math.floor((110 + Math.floor(selfScore / 17000) +
            Math.floor(Math.min(otherScore, 5200000) / 400000)) * musicRate0 * deckRate) * boostRate
      case EventLiveType.CHEERFUL:
        return Math.floor((114 + Math.floor(selfScore / 12500) +
          Math.floor(Math.min(otherScore, 4400000) / 400000) + Math.floor(Math.min(life, 1000) / 25)) *
          musicRate0 * deckRate) * boostRate
    }
  }
}

export enum EventLiveType {
  SOLO = 'solo',
  CHALLENGE = 'challenge',
  MULTI = 'multi',
  CHEERFUL = 'cheerful'
}
