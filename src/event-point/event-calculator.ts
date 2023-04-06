import { type DataProvider } from '../data-provider/data-provider'
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

    // switch里面不能声明变量，放在外面
    let baseScore = 0
    let lifeRate = 0
    switch (type) {
      case LiveType.SOLO:
      case LiveType.AUTO:
        baseScore = 100 + Math.floor(selfScore / 20000)
        return Math.floor(baseScore * musicRate0 * deckRate) * boostRate
      case LiveType.CHALLENGE:
        baseScore = 100 + Math.floor(selfScore / 20000)
        return baseScore * 120
      case LiveType.MULTI:
        baseScore = (110 + Math.floor(selfScore / 17000) + Math.min(13, Math.floor(otherScore0 / 340000)))
        return Math.floor(baseScore * musicRate0 * deckRate) * boostRate
      case LiveType.CHEERFUL:
        baseScore = (110 + Math.floor(selfScore / 17000) + Math.min(13, Math.floor(otherScore0 / 340000)))
        lifeRate = 1.15 + Math.min(Math.max(life / 5000, 0.1), 0.2)
        return Math.floor(Math.floor(baseScore * musicRate0 * deckRate) * lifeRate) * boostRate
    }
  }

  /**
   * 获取卡组活动加成
   * @param deckCards 卡组
   */
  public static getDeckBonus (deckCards: CardDetail[]): number | undefined {
    // 如果没有预处理好活动加成，则返回空
    for (const card of deckCards) {
      if (card.eventBonus === undefined) return undefined
    }
    return deckCards.reduce((v, it) => v + (it.eventBonus === undefined ? 0 : it.eventBonus), 0)
  }

  /**
   * 获得卡组活动点数
   * @param deckCards 卡组
   * @param honorBonus 称号加成
   * @param musicMeta 歌曲信息
   * @param liveType Live类型
   */
  public static getDeckEventPoint (deckCards: CardDetail[], honorBonus: number, musicMeta: MusicMeta, liveType: LiveType): number {
    const deckBonus = this.getDeckBonus(deckCards)
    if (liveType !== LiveType.CHALLENGE && deckBonus === undefined) throw new Error('Deck bonus is undefined')
    const score = LiveCalculator.getLiveScoreByDeck(deckCards, honorBonus, musicMeta, liveType)
    return EventCalculator.getEventPoint(liveType, score, musicMeta.event_rate, deckBonus)
  }
}
