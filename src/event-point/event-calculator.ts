import type { DataProvider } from '../common/data-provider'
import { CardEventCalculator } from './card-event-calculator'
import { type UserCard } from '../user-data/user-card'
import { type CardDetail } from '../deck-information/card-calculator'
import { LiveCalculator, LiveType } from '../live-score/live-calculator'
import { type MusicMeta } from '../common/music-meta'

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
   * @param otherScore 他人分数（用于多人Live、留空用4倍自己的分数）
   * @param life 剩余血量（用于对战Live）
   */
  public static getEventPoint (
    type: LiveType, selfScore: number, musicRate: number = 100, deckBonus: number = 0, boostRate: number = 1,
    otherScore: number = 0, life: number = 1000
  ): number {
    const musicRate0 = musicRate / 100
    const deckRate = deckBonus / 100 + 1
    const otherScore0 = otherScore === 0 ? 4 * selfScore : otherScore
    switch (type) {
      case LiveType.SOLO:
      case LiveType.AUTO:
        return Math.floor((100 + Math.floor(selfScore / 20000)) * musicRate0 * deckRate) * boostRate
      case LiveType.CHALLENGE:
        return (100 + Math.floor(selfScore / 20000)) * 120
      case LiveType.MULTI:
        return Math.floor((110 + Math.floor(selfScore / 17000) +
          Math.floor(Math.min(otherScore0, 5200000) / 400000)) * musicRate0 * deckRate) * boostRate
      case LiveType.CHEERFUL:
        return Math.floor((114 + Math.floor(selfScore / 12500) +
            Math.floor(Math.min(otherScore0, 4400000) / 400000) + Math.floor(Math.min(life, 1000) / 25)) *
          musicRate0 * deckRate) * boostRate
    }
  }

  /**
   * 获得卡组活动点数
   * @param deckCards 卡组
   * @param honorBonus 称号加成
   * @param musicMeta 歌曲信息
   * @param liveType Live类型
   */
  public static getDeckEventPoint (deckCards: CardDetail[], honorBonus: number, musicMeta: MusicMeta, liveType: LiveType): number {
    const deckBonus = deckCards.reduce((v, it) => v + (it.eventBonus === undefined ? 0 : it.eventBonus), 0)
    const score = LiveCalculator.getLiveScoreByDeck(deckCards, honorBonus, musicMeta, liveType)
    return EventCalculator.getEventPoint(liveType, score, musicMeta.event_rate, deckBonus)
  }
}
