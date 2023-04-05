import { type DataProvider } from '../data-provider/data-provider'
import { CardCalculator, type CardConfig, type CardDetail } from '../deck-information/card-calculator'
import { DeckCalculator } from '../deck-information/deck-calculator'
import { LiveCalculator, type LiveType } from '../live-score/live-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { computeWithDefault, containsAny } from '../util/collection-util'
import { EventCalculator } from '../event-point/event-calculator'

export class BaseDeckRecommend {
  private readonly cardCalculator: CardCalculator
  private readonly deckCalculator: DeckCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.deckCalculator = new DeckCalculator(dataProvider)
  }

  /**
   * 判断某属性或者组合角色数量至少5个
   * @param cardDetails 卡牌
   * @private
   */
  private static canMakeEventDeck (cardDetails: CardDetail[]): boolean {
    // 统计组合或者属性的不同角色出现次数
    const map = new Map<string, Set<number>>()
    for (const cardDetail of cardDetails) {
      computeWithDefault(map, cardDetail.attr, new Set(), it => it.add(cardDetail.characterId))
      for (const unit of cardDetail.units) {
        computeWithDefault(map, unit, new Set(), it => it.add(cardDetail.characterId))
      }
    }
    // 如果有任何一个大于等于5，就没问题
    for (const v of map.values()) {
      if (v.size >= 5) return true
    }
    return false
  }

  /**
   * 过滤纳入计算的卡牌，排除掉活动加成不行的卡牌
   * 返回的卡牌按卡牌ID排序
   * @param cardDetails 卡牌详情
   * @private
   */
  private static filterCard (cardDetails: CardDetail[]): CardDetail[] {
    // 根据活动加成，排除掉一些加成较低的卡牌
    let afterFilter = cardDetails
    for (const minBonus of [55, 50, 45, 40, 30, 25, 15, 5, 0]) {
      const bonusFilter = cardDetails.filter(cardDetail =>
        !(cardDetail.eventBonus !== undefined && cardDetail.eventBonus < minBonus))
      if (this.canMakeEventDeck(bonusFilter)) {
        afterFilter = bonusFilter
        break
      }
    }
    // console.log(afterFilter.map(it => it.cardId))
    // console.log(`Origin:${cardDetails.length} After:${afterFilter.length}`)
    return afterFilter
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
      return [{
        score,
        power: deckDetail.power,
        eventBonus: deckDetail.eventBonus,
        deckCards
      }]
    }
    // 非完整卡组，继续遍历所有情况
    let ans: RecommendDeck[] = []
    let preCard = cardDetails[0]
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
      // 除非当前卡明确比上一张卡小、不然就要ID大
      if (deckCards.length >= 2 && !CardCalculator.isCertainlyLessThan(card, deckCards[deckCards.length - 1]) &&
        card.cardId < deckCards[deckCards.length - 1].cardId) {
        continue
      }
      // 如果肯定比上一次选定的卡牌要弱，那么舍去，让这张卡去后面再选
      if (CardCalculator.isCertainlyLessThan(card, preCard)) continue
      preCard = card
      // 递归，寻找所有情况
      const result = BaseDeckRecommend.findBestCards(
        cardDetails, scoreFunc, limit, isChallengeLive, member,
        honorBonus, [...deckCards, card], [...deckCharacters, card.characterId])
      // 更新答案，按分数高到低排序、限制数量（可能用个堆来维护更合适）
      ans = [...ans, ...result].sort((a, b) => b.score - a.score)
      if (ans.length > limit) ans = ans.slice(0, limit)
    }
    // 在最外层检查一下是否成功组队
    if (deckCards.length === 0 && ans.length === 0) throw new Error(`Cannot find deck in ${cardDetails.length} cards`)

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
    { musicMeta, limit = 1, member = 5, cardConfig = {} }: DeckRecommendConfig,
    eventId: number = 0, isChallengeLive: boolean = false
  ): Promise<RecommendDeck[]> {
    const cards = await this.cardCalculator.batchGetCardDetail(userCards, cardConfig, eventId)
    let cardDetails = (isChallengeLive || eventId === 0) ? cards : BaseDeckRecommend.filterCard(cards)
    cardDetails = cardDetails.sort((a, b) => a.cardId - b.cardId)// 按ID排序
    const honorBonus = await this.deckCalculator.getHonorBonusPower()
    // console.log(`All:${userCards.length}, used:${cardDetails.length}`)
    return BaseDeckRecommend.findBestCards(cardDetails,
      deckCards => scoreFunc(musicMeta, honorBonus, deckCards), limit, isChallengeLive, member, honorBonus)
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
  deckCards: CardDetail[]
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
