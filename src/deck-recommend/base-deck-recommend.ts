import { type DataProvider } from '../data-provider/data-provider'
import { CardCalculator, type CardConfig, type CardDetail } from '../card-information/card-calculator'
import {
  DeckCalculator,
  type DeckDetail
} from '../deck-information/deck-calculator'
import { LiveType } from '../live-score/live-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { containsAny, swap } from '../util/collection-util'
import { filterCardPriority } from '../card-priority/card-priority-filter'
import { updateDeck } from './deck-result-update'
import { AreaItemService } from '../area-item-information/area-item-service'
import { type EventConfig, EventType } from '../event-point/event-service'

export class BaseDeckRecommend {
  private readonly cardCalculator: CardCalculator
  private readonly deckCalculator: DeckCalculator
  private readonly areaItemService: AreaItemService

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.deckCalculator = new DeckCalculator(dataProvider)
    this.areaItemService = new AreaItemService(dataProvider)
  }

  /**
   * 使用递归寻找最佳卡组
   * 栈深度不超过member+1层
   * 复杂度O(n^member)，带大量剪枝
   * （按分数高到低排序）
   * @param cardDetails 参与计算的卡牌
   * @param allCards 全部卡牌（按支援卡组加成排序）
   * @param scoreFunc 获得分数的公式
   * @param limit 需要推荐的卡组数量（按分数高到低）
   * @param isChallengeLive 是否挑战Live（人员可重复）
   * @param member 人数限制（2-5、默认5）
   * @param honorBonus 称号加成
   * @param eventType （可选）活动类型
   * @param deckCards 计算过程中的当前卡组
   * @param deckCharacters 当前卡组的人员
   * @private
   */
  private async findBestCards (
    cardDetails: CardDetail[], allCards: CardDetail[], scoreFunc: (deckDetail: DeckDetail) => number, limit: number = 1,
    isChallengeLive: boolean = false, member: number = 5, honorBonus: number = 0, eventType?: EventType, deckCards: CardDetail[] = [], deckCharacters: number[] = []
  ): Promise<RecommendDeck[]> {
    // 防止挑战Live卡的数量小于允许上场的数量导致无法组队
    if (isChallengeLive) {
      member = Math.min(member, cardDetails.length)
    }
    // 已经是完整卡组，计算当前卡组的值
    if (deckCards.length === member) {
      const deckDetail =
        await this.deckCalculator.getDeckDetailByCards(deckCards, allCards, honorBonus, eventType)
      const score = scoreFunc(deckDetail)
      const cards = deckDetail.cards
      // 寻找加分效果最高的卡牌
      let bestScoreUp = cards[0].skill.scoreUp
      let bestScoreIndex = 0
      cards.forEach((it, i) => {
        if (it.skill.scoreUp > bestScoreUp) {
          bestScoreUp = it.skill.scoreUp
          bestScoreIndex = i
        }
      })
      // 如果现在C位已经对了（加分技能最高的卡牌在C位）
      if (bestScoreIndex === 0) {
        const ret = deckDetail as RecommendDeck
        ret.score = score
        return [ret]
      }
      // 不然就重新算调整过C位后的分数
      swap(deckCards, 0, bestScoreIndex)
      return await this.findBestCards(cardDetails, allCards, scoreFunc, limit, isChallengeLive, member, honorBonus, eventType, deckCards, deckCharacters)
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
      if (deckCards.length >= 1 && deckCards[0].skill.isCertainlyLessThen(card.skill)) continue
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
      const result = await this.findBestCards(
        cardDetails, allCards, scoreFunc, limit, isChallengeLive, member,
        honorBonus, eventType, [...deckCards, card], [...deckCharacters, card.characterId])
      ans = updateDeck(ans, result, limit)
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
   * @param debugLog 测试日志处理函数
   * @param liveType Live类型
   * @param eventId 活动ID（如果要计算活动PT的话）
   * @param eventType 活动类型（如果要计算活动PT的话）
   * @param eventUnit 箱活的团队（用于把卡过滤到只剩该团队）
   * @param specialCharacterId 指定角色ID（如果要计算世界开花活动PT的话）
   * @param isChallengeLive 是否挑战Live（人员可重复）
   */
  public async recommendHighScoreDeck (
    userCards: UserCard[], scoreFunc: ScoreFunction,
    {
      musicMeta,
      limit = 1,
      member = 5,
      cardConfig = {},
      debugLog = (_: string) => {
      }
    }: DeckRecommendConfig,
    liveType: LiveType,
    {
      eventId = 0,
      eventType = EventType.NONE,
      eventUnit = undefined,
      specialCharacterId = 0
    }: EventConfig = {}
  ): Promise<RecommendDeck[]> {
    const areaItemLevels = await this.areaItemService.getAreaItemLevels()
    let cards = await this.cardCalculator.batchGetCardDetail(userCards, cardConfig,
      {
        eventId,
        specialCharacterId
      }, areaItemLevels)
    // 过滤箱活的卡，不上其它组合的
    if (eventUnit !== undefined) {
      const originCardsLength = cards.length
      cards = cards.filter(it =>
        (it.units.length === 1 && it.units[0] === 'piapro') || it.units.includes(eventUnit))
      debugLog(`Cards filtered with unit: ${cards.length}/${originCardsLength}`)
      debugLog(cards.map(it => it.cardId).toString())
    }
    const honorBonus = await this.deckCalculator.getHonorBonusPower()

    // 为了优化性能，会根据活动加成和卡牌稀有度优先级筛选卡牌
    let preCardDetails = [] as CardDetail[]
    while (true) {
      const cardDetails = filterCardPriority(liveType, eventType, cards, preCardDetails, member)
      if (cardDetails.length === preCardDetails.length) {
        // 如果所有卡牌都上阵了还是组不出队伍，就报错
        throw new Error(`Cannot recommend any deck in ${cards.length} cards`)
      }
      preCardDetails = cardDetails
      const cards0 = cardDetails.sort((a, b) => a.cardId - b.cardId)
      debugLog(`Recommend deck with ${cards0.length}/${cards.length} cards `)
      debugLog(cards0.map(it => it.cardId).toString())
      const recommend = await this.findBestCards(cards0,
        cards,
        deckDetail => scoreFunc(musicMeta, deckDetail),
        limit, liveType === LiveType.CHALLENGE, member, honorBonus, eventType)
      if (recommend.length >= limit) return recommend
    }
  }
}

export type ScoreFunction = (musicMeta: MusicMeta, deckDetail: DeckDetail) => number

export interface RecommendDeck extends DeckDetail {
  score: number
  // power: DeckPowerDetail
  // eventBonus?: number
  // supportDeckBonus?: number
  // deckCards: DeckCardDetail[]
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
   * key为各个稀有度
   */
  cardConfig?: Record<string, CardConfig>
  /**
   * 处理测试日志的函数
   * @param str 日志内容
   */
  debugLog?: (str: string) => void
}
