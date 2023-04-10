import { type DataProvider } from '../data-provider/data-provider'
import { CardCalculator, type CardConfig, type CardDetail } from '../deck-information/card-calculator'
import { DeckCalculator, type DeckCardDetail } from '../deck-information/deck-calculator'
import { LiveCalculator, type LiveType } from '../live-score/live-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { containsAny, swap } from '../util/collection-util'
import { EventCalculator } from '../event-point/event-calculator'
import { filterCardPriority } from './card-priority-filter'

export class BaseDeckRecommend {
  private readonly cardCalculator: CardCalculator
  private readonly deckCalculator: DeckCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.deckCalculator = new DeckCalculator(dataProvider)
  }

  /**
   * 使用递归寻找最佳卡组
   * （按分数高到低排序）
   * @param cardDetails 参与计算的卡牌
   * @param scoreFunc 获得分数的公式
   * @param limit 需要推荐的卡组数量（按分数高到低）
   * @param isChallengeLive 是否挑战Live（人员可重复）
   * @param member 人数限制（2-5、默认5）
   * @param honorBonus 称号加成
   * @param deckCards 计算过程中的当前卡组
   * @param deckCharacters 当前卡组的人员
   * @private
   */
  private static findBestCards (
    cardDetails: CardDetail[], scoreFunc: (deckCards: CardDetail[]) => number, limit: number = 1,
    isChallengeLive: boolean = false, member: number = 5, honorBonus: number = 0, deckCards: CardDetail[] = [], deckCharacters: number[] = []
  ): RecommendDeck[] {
    // 已经是完整卡组，计算当前卡组的值
    if (deckCards.length === member) {
      const score = scoreFunc(deckCards)
      const deckDetail = DeckCalculator.getDeckDetailByCards(deckCards, honorBonus)
      const cards = deckDetail.cards
      // 寻找加分效果最高的卡牌
      let bestScoreUp = cards[0].scoreUp
      let bestScoreIndex = 0
      cards.forEach((it, i) => {
        if (it.scoreUp > bestScoreUp) {
          bestScoreUp = it.scoreUp
          bestScoreIndex = i
        }
      })
      // 如果现在C位已经对了
      if (bestScoreIndex === 0) {
        return [{
          score,
          power: deckDetail.power,
          eventBonus: deckDetail.eventBonus,
          deckCards: cards
        }]
      }
      // 不然就重新算调整过C位后的分数
      swap(deckCards, 0, bestScoreIndex)
      return this.findBestCards(cardDetails, scoreFunc, limit, isChallengeLive, member, honorBonus, deckCards, deckCharacters)
    }
    // 非完整卡组，继续遍历所有情况
    let ans: RecommendDeck[] = []
    let preCard: CardDetail | null = null
    for (const card of cardDetails) {
      // 跳过已经重复出现过的卡牌
      if (deckCards.includes(card)) continue
      // 跳过重复角色
      if (!isChallengeLive && deckCharacters.includes(card.characterId)) continue
      // C位一定是技能最好的卡牌，跳过技能比C位还好的
      if (deckCards.length >= 1 && deckCards[0].scoreSkill.isCertainlyLessThen(card.scoreSkill)) continue
      // 为了优化性能，必须和C位同色或同组
      if (deckCards.length >= 1 && card.attr !== deckCards[0].attr && !containsAny(deckCards[0].units, card.units)) {
        continue
      }
      // 要求生成的卡组后面4个位置按强弱排序、同强度按卡牌ID排序
      // 如果上一张卡肯定小，那就不符合顺序；在旗鼓相当的前提下（因为两两组合有四种情况，再排除掉这张卡肯定小的情况，就是旗鼓相当），要ID大
      if (deckCards.length >= 2 && CardCalculator.isCertainlyLessThan(deckCards[deckCards.length - 1], card)) continue
      if (deckCards.length >= 2 && !CardCalculator.isCertainlyLessThan(card, deckCards[deckCards.length - 1]) &&
        card.cardId < deckCards[deckCards.length - 1].cardId) {
        continue
      }
      // 如果肯定比上一次选定的卡牌要弱，那么舍去，让这张卡去后面再选
      if (preCard !== null && CardCalculator.isCertainlyLessThan(card, preCard)) continue
      preCard = card
      // 递归，寻找所有情况
      const result = BaseDeckRecommend.findBestCards(
        cardDetails, scoreFunc, limit, isChallengeLive, member,
        honorBonus, [...deckCards, card], [...deckCharacters, card.characterId])
      // 更新答案，按分数高到低排序可能用个堆来维护更合适）
      ans = [...ans, ...result].sort((a, b) => b.score - a.score)
      // 排除重复答案
      ans = ans.filter((it, i, arr) => {
        // 第一个位置 没法排除
        if (i === 0) return true
        const pre = arr[i - 1]
        // 如果分数或者综合不一样，说明肯定不是同一队
        if (pre.score !== it.score || pre.power !== it.power) return true
        // 如果C位不一样，也不认为是同一队
        return pre.deckCards[0].cardId !== it.deckCards[0].cardId
      })
      // 限制答案数量
      if (ans.length > limit) ans = ans.slice(0, limit)
    }
    // 在最外层检查一下是否成功组队
    if (deckCards.length === 0 && ans.length === 0) {
      console.warn(`Cannot find deck in ${cardDetails.length} cards(${cardDetails.map(it => it.cardId).toString()})`)
      return []
    }

    // 按分数从高到低排序、限制数量
    return ans
  }

  /**
   * 推荐高分卡组
   * @param userCards 参与推荐的卡牌
   * @param scoreFunc 分数计算公式
   * @param musicMeta 歌曲信息
   * @param limit 需要推荐的卡组数量（按分数高到低）
   * @param member 限制人数（2-5、默认5）
   * @param cardConfig 卡牌设置
   * @param eventId 活动ID（如果要计算活动PT的话）
   * @param isChallengeLive 是否挑战Live（人员可重复）
   */
  public async recommendHighScoreDeck (
    userCards: UserCard[], scoreFunc: ScoreFunction,
    {
      musicMeta,
      limit = 1,
      member = 5,
      cardConfig = {}
    }: DeckRecommendConfig,
    eventId: number = 0, isChallengeLive: boolean = false
  ): Promise<RecommendDeck[]> {
    const cards = await this.cardCalculator.batchGetCardDetail(userCards, cardConfig, eventId)
    const honorBonus = await this.deckCalculator.getHonorBonusPower()

    let priority = (isChallengeLive || eventId === 0) ? 10 : 0
    while (priority < 10) {
      const cardDetails = filterCardPriority(cards, priority)
      const cards0 = cardDetails.cardDetails.sort((a, b) => a.cardId - b.cardId)
      priority = cardDetails.priority
      const recommend = BaseDeckRecommend.findBestCards(cards0,
        deckCards => scoreFunc(musicMeta, honorBonus, deckCards),
        limit, isChallengeLive, member, honorBonus)
      if (recommend.length >= limit) return recommend
    }
    const cards1 = cards.sort((a, b) => a.cardId - b.cardId)
    const recommend = BaseDeckRecommend.findBestCards(cards1,
      deckCards => scoreFunc(musicMeta, honorBonus, deckCards),
      limit, isChallengeLive, member, honorBonus)
    if (recommend.length > 0) return recommend
    throw new Error(`Cannot recommend any deck in ${cards.length} cards`)
  }

  /**
   * 获取计算歌曲分数的函数
   * @param liveType Live类型
   */
  public static getLiveScoreFunction (liveType: LiveType): ScoreFunction {
    return (musicMeta, honorBonus, deckCards) =>
      LiveCalculator.getLiveScoreByDeck(deckCards, honorBonus, musicMeta, liveType)
  }

  /**
   * 获取计算活动PT的函数
   * @param liveType Live类型
   */
  public static getEventPointFunction (liveType: LiveType): ScoreFunction {
    return (musicMeta, honorBonus, deckCards) =>
      EventCalculator.getDeckEventPoint(deckCards, honorBonus, musicMeta, liveType)
  }
}

export type ScoreFunction = (musicMeta: MusicMeta, honorBonus: number, deckCards: CardDetail[]) => number

export interface RecommendDeck {
  score: number
  power: number
  eventBonus?: number
  deckCards: DeckCardDetail[]
}

export interface DeckRecommendConfig {
  /**
   * 歌曲信息
   */
  musicMeta: MusicMeta
  /**
   * 需要推荐的卡组数量（按分数高到低）
   */
  limit?: number
  /**
   * 限制人数（2-5、默认5）
   */
  member?: number
  /**
   * 卡牌设置
   */
  cardConfig?: CardConfig
}
