import { CardCalculator, type CardDetail } from '../card-information/card-calculator'
import { DeckCalculator, type DeckDetail } from '../deck-information/deck-calculator'
import { filterCardPriority } from '../card-priority/card-priority-filter'
import { containsAny, swap } from '../util/collection-util'
import { isDeckAttrLessThan3, toRecommendDeck, updateDeck } from './deck-result-update'
import type { EventConfig, EventType } from '../event-point/event-service'
import { LiveType } from '../live-score/live-calculator'
import type { RecommendDeck } from './deck-recommend-type'
import type { DeckRecommendContext } from './deck-strategy'

/**
 * 递归搜索的设置
 */
export interface DeckSearchConfig {
  /**
   * 参与计算的全部卡牌（用于应援卡组加成，必须保持全量）
   */
  allCards: CardDetail[]
  /**
   * 卡组分数（已经绑定好歌曲信息）
   */
  scoreFunc: (deckDetail: DeckDetail) => number
  /**
   * 需要推荐的卡组数量
   */
  limit: number
  /**
   * 是否挑战Live（人员可重复）
   */
  isChallengeLive: boolean
  /**
   * 人数限制
   */
  member: number
  /**
   * C位角色ID（0 表示自动选技能最好的）
   */
  leaderCharacter: number
  /**
   * 称号加成
   */
  honorBonus: number
  /**
   * Live类型
   */
  liveType: LiveType
  /**
   * 活动类型
   */
  eventType: EventType
  /**
   * 活动配置
   */
  eventConfig: EventConfig
  /**
   * 除 C 位以外，允许放进同一卡组的判断（不同活动剪枝规则不同）
   */
  canAddToDeck: (leader: CardDetail, card: CardDetail) => boolean
}

/**
 * 卡组递归搜索
 * 只负责「给定候选卡牌 → 搜出最好的若干套」，候选怎么来由各个推荐策略决定
 */
export class DeckSearch {
  /**
   * 默认剪枝：必须和 C 位同色或同组
   * 这样活动加成和区域道具加成都不会浪费
   * @param leader C位卡牌
   * @param card 待加入的卡牌
   */
  public static readonly sameAttrOrUnit = (leader: CardDetail, card: CardDetail): boolean =>
    card.attr === leader.attr || containsAny(leader.units, card.units)

  /**
   * 按优先级筛选候选卡牌，再递归搜索卡组
   * @param searchCards 参与优先级筛选的候选卡牌
   * @param config 搜索设置
   * @param debugLog 日志处理函数
   */
  public static search (
    searchCards: CardDetail[], config: DeckSearchConfig, debugLog: (str: string) => void
  ): RecommendDeck[] {
    // 为了优化性能，会根据活动加成和卡牌稀有度优先级筛选卡牌
    let preCardDetails = [] as CardDetail[]
    let preRecommend = [] as RecommendDeck[]
    while (true) {
      const cardDetails = filterCardPriority(config.liveType, config.eventType, searchCards,
        preCardDetails, config.member, config.leaderCharacter)
      if (cardDetails.length === preCardDetails.length) {
        // 所有卡牌都上阵了还是凑不够数量，能给出几套就给几套
        if (preRecommend.length > 0) return preRecommend
        // 如果所有卡牌都上阵了还是组不出队伍，就报错
        throw new Error(`Cannot recommend any deck in ${searchCards.length} cards`)
      }
      preCardDetails = cardDetails
      const cards0 = cardDetails.sort((a, b) => a.cardId - b.cardId)
      debugLog(`Recommend deck with ${cards0.length}/${searchCards.length} cards `)
      debugLog(cards0.map(it => it.cardId).toString())
      const recommend = DeckSearch.findBestCards(cards0, config)
      if (recommend.length >= config.limit) return recommend
      preRecommend = recommend
    }
  }

  /**
   * 使用递归寻找最佳卡组
   * 栈深度不超过member+1层
   * 复杂度O(n^member)，带大量剪枝
   * （按分数高到低排序）
   * @param cardDetails 参与计算的卡牌
   * @param config 搜索设置
   * @param deckCards 计算过程中的当前卡组
   */
  public static findBestCards (
    cardDetails: CardDetail[], config: DeckSearchConfig, deckCards: CardDetail[] = []
  ): RecommendDeck[] {
    // 防止挑战Live卡的数量小于允许上场的数量导致无法组队
    const member = config.isChallengeLive ? Math.min(config.member, cardDetails.length) : config.member
    const { allCards, honorBonus, leaderCharacter, eventConfig } = config
    // 已经是完整卡组，计算当前卡组的值
    if (deckCards.length === member) {
      const deckDetail = DeckCalculator.getDeckDetailByCards(
        deckCards, allCards, honorBonus, eventConfig.cardBonusCountLimit,
        eventConfig.worldBloomDifferentAttributeBonuses, eventConfig.totalPowerLimit
      )
      const score = config.scoreFunc(deckDetail)
      // 如果固定leader，不检查技能效果直接返回
      if (leaderCharacter > 0) {
        return toRecommendDeck(deckDetail, score)
      }
      // 寻找加分效果最高的卡牌
      const cards = deckDetail.cards
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
        return toRecommendDeck(deckDetail, score)
      }
      // 不然就重新算调整过C位后的分数
      swap(deckCards, 0, bestScoreIndex)
      return DeckSearch.findBestCards(cardDetails, config, deckCards)
    }
    // 非完整卡组，继续遍历所有情况
    let ans: RecommendDeck[] = []
    let preCard: CardDetail | null = null
    for (const card of cardDetails) {
      // 跳过已经重复出现过的卡牌
      if (deckCards.some(it => it.cardId === card.cardId)) {
        continue
      }
      // 跳过重复角色
      if (!config.isChallengeLive && deckCards.some(it => it.characterId === card.characterId)) {
        continue
      }
      // 如果固定leader，要判断第一张卡是不是指定角色
      if (leaderCharacter > 0 && deckCards.length === 0 && card.characterId !== leaderCharacter) {
        continue
      }
      // C位一定是技能最好的卡牌，跳过技能比C位还好的
      // 如果固定leader，这边不能跳过
      if (leaderCharacter <= 0 && deckCards.length >= 1 && deckCards[0].skill.isCertainlyLessThen(card.skill)) {
        continue
      }
      // 为了优化性能，按当前活动的规则判断能不能和C位同队
      if (deckCards.length >= 1 && !config.canAddToDeck(deckCards[0], card)) {
        continue
      }
      // 为了优化性能，如果是World Link活动，强制3色及以上
      if (eventConfig.worldBloomDifferentAttributeBonuses !== undefined && isDeckAttrLessThan3(deckCards, card)) {
        continue
      }
      // 要求生成的卡组后面4个位置按强弱排序、同强度按卡牌ID排序
      // 如果上一张卡肯定小，那就不符合顺序；在旗鼓相当的前提下（因为两两组合有四种情况，再排除掉这张卡肯定小的情况，就是旗鼓相当），要ID大
      if (deckCards.length >= 2 && CardCalculator.isCertainlyLessThan(deckCards[deckCards.length - 1], card)) {
        continue
      }
      if (deckCards.length >= 2 && !CardCalculator.isCertainlyLessThan(card, deckCards[deckCards.length - 1]) &&
        card.cardId < deckCards[deckCards.length - 1].cardId) {
        continue
      }
      // 如果肯定比上一次选定的卡牌要弱，那么舍去，让这张卡去后面再选
      if (preCard !== null && CardCalculator.isCertainlyLessThan(card, preCard)) {
        continue
      }
      preCard = card
      // 递归，寻找所有情况
      const result = DeckSearch.findBestCards(cardDetails, config, [...deckCards, card])
      ans = updateDeck(ans, result, config.limit)
    }
    // 在最外层检查一下是否成功组队
    if (deckCards.length === 0 && ans.length === 0) {
      console.warn(`Cannot find deck in ${cardDetails.length} cards(${cardDetails.map(it => it.cardId).toString()})`)
      return []
    }

    // 按分数从高到低排序、限制数量
    return ans
  }
}

/**
 * 用推荐输入 + 剪枝规则生成搜索设置
 * @param context 推荐输入
 * @param canAddToDeck 除 C 位以外允许同队的判断
 */
export function createSearchConfig (
  context: DeckRecommendContext, canAddToDeck: (leader: CardDetail, card: CardDetail) => boolean
): DeckSearchConfig {
  return {
    allCards: context.allCards,
    scoreFunc: deckDetail => context.scoreFunc(context.musicMeta, deckDetail),
    limit: context.limit,
    isChallengeLive: context.liveType === LiveType.CHALLENGE,
    member: context.member,
    leaderCharacter: context.leaderCharacter,
    honorBonus: context.honorBonus,
    liveType: context.liveType,
    eventType: context.eventType,
    eventConfig: context.eventConfig,
    canAddToDeck
  }
}
