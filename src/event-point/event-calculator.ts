import { type DataProvider } from '../data-provider/data-provider'
import { CardEventCalculator } from './card-event-calculator'
import { type UserCard } from '../user-data/user-card'
import { type CardDetail } from '../card-information/card-calculator'
import { LiveCalculator, LiveType } from '../live-score/live-calculator'
import { type MusicMeta } from '../common/music-meta'
import { type ScoreFunction } from '../deck-recommend/base-deck-recommend'
import { EventType } from './event-service'
import { type DeckDetail } from '../deck-information/deck-calculator'
import { safeNumber } from '../util/number-util'
import { type WorldBloomDifferentAttributeBonus } from '../master-data/world-bloom-different-attribute-bonus'
import { findOrThrow } from '../util/collection-util'

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
   * @param liveType Live类型
   * @param eventType 活动类型
   * @param selfScore 个人分数
   * @param musicRate 歌曲系数（百分比、挑战Live无用）
   * @param deckBonus 卡组加成（百分比、挑战Live无用）
   * @param boostRate 消耗系数（挑战Live无用）
   * @param otherScore 他人分数（用于多人Live、留空用4倍自己的分数）
   * @param life 剩余血量（用于对战Live）
   */
  public static getEventPoint (
    liveType: LiveType, eventType: EventType, selfScore: number, musicRate: number = 100, deckBonus: number = 0, boostRate: number = 1,
    otherScore: number = 0, life: number = 1000
  ): number {
    const musicRate0 = musicRate / 100
    const deckRate = deckBonus / 100 + 1
    const otherScore0 = otherScore === 0 ? 4 * selfScore : otherScore

    // switch里面不能声明变量，放在外面
    let baseScore = 0
    let lifeRate = 0
    switch (liveType) {
      case LiveType.SOLO:
      case LiveType.AUTO:
        baseScore = 100 + Math.floor(selfScore / 20000)
        return Math.floor(baseScore * musicRate0 * deckRate) * boostRate
      case LiveType.CHALLENGE:
        baseScore = 100 + Math.floor(selfScore / 20000)
        return baseScore * 120
      case LiveType.MULTI:
        if (eventType === EventType.CHEERFUL) throw new Error('Multi live is not playable in cheerful event.')
        baseScore = (110 + Math.floor(selfScore / 17000) + Math.min(13, Math.floor(otherScore0 / 340000)))
        return Math.floor(baseScore * musicRate0 * deckRate) * boostRate
      case LiveType.CHEERFUL:
        if (eventType !== EventType.CHEERFUL) throw new Error('Cheerful live is only playable in cheerful event.')
        baseScore = (110 + Math.floor(selfScore / 17000) + Math.min(13, Math.floor(otherScore0 / 340000)))
        lifeRate = 1.15 + Math.min(Math.max(life / 5000, 0.1), 0.2)
        return Math.floor(Math.floor(baseScore * musicRate0 * deckRate) * lifeRate) * boostRate
    }
  }

  /**
   * 获取卡组活动加成
   * @param deckCards 卡组
   * @param eventType （可选）活动类型
   */
  public async getDeckBonus (deckCards: CardDetail[], eventType: EventType = EventType.NONE): Promise<number | undefined> {
    // 如果没有预处理好活动加成，则返回空
    for (const card of deckCards) {
      if (card.eventBonus === undefined) return undefined
    }
    const bonus = deckCards.reduce((v, it) => v + (it.eventBonus === undefined ? 0 : it.eventBonus), 0)
    if (eventType !== EventType.BLOOM) return bonus

    // 如果是世界开花活动，还需要计算卡组的异色加成
    const worldBloomDifferentAttributeBonuses =
      await this.dataProvider.getMasterData<WorldBloomDifferentAttributeBonus>('worldBloomDifferentAttributeBonuses')
    const set = new Set<string>()
    deckCards.forEach(it => set.add(it.attr))
    return bonus + findOrThrow(worldBloomDifferentAttributeBonuses,
      it => it.attributeCount === set.size).bonusRate
  }

  /**
   * 获取支援卡组加成
   * @param deckCards 卡组
   * @param allCards 所有卡牌（按支援卡组加成从大到小排序）
   */
  public static getSupportDeckBonus (deckCards: CardDetail[], allCards: CardDetail[]): number | undefined {
    let bonus = 0
    let count = 0
    // 如果没有预处理好支援卡组加成，则返回空
    for (const card of allCards) {
      if (card.supportDeckBonus === undefined) return undefined
      // 支援卡组的卡不能和主队伍重复，需要排除掉
      if (deckCards.includes(card)) continue
      bonus += card.supportDeckBonus
      count++
      // 支援卡组为12张卡
      if (count >= 12) return bonus
    }
    // 就算组不出12张卡也得返回
    return bonus
  }

  /**
   * 获得卡组活动点数
   * @param deckDetail 卡组
   * @param musicMeta 歌曲信息
   * @param liveType Live类型
   * @param eventType 活动类型
   */
  public static getDeckEventPoint (deckDetail: DeckDetail, musicMeta: MusicMeta, liveType: LiveType, eventType: EventType): number {
    const deckBonus = deckDetail.eventBonus
    if (liveType !== LiveType.CHALLENGE && deckBonus === undefined) throw new Error('Deck bonus is undefined')
    const supportDeckBonus = deckDetail.supportDeckBonus
    if (eventType === EventType.BLOOM && supportDeckBonus === undefined) throw new Error('Support deck bonus is undefined')
    const score = LiveCalculator.getLiveScoreByDeck(deckDetail, musicMeta, liveType)
    return EventCalculator.getEventPoint(liveType, eventType, score, musicMeta.event_rate,
      safeNumber(deckBonus) + safeNumber((supportDeckBonus)))
  }

  /**
   * 获取计算活动PT的函数
   * @param liveType Live类型
   * @param eventType 活动类型
   */
  public static getEventPointFunction (liveType: LiveType, eventType: EventType): ScoreFunction {
    return (musicMeta, deckDetail) =>
      EventCalculator.getDeckEventPoint(deckDetail, musicMeta, liveType, eventType)
  }
}
