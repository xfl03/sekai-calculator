import { CardCandidates } from './card-candidates'
import { createSearchConfig, DeckSearch } from './deck-search'
import type { DeckRecommendContext, DeckRecommendStrategy } from './deck-strategy'
import type { RecommendDeck } from './deck-recommend-type'
import { updateDeck } from './deck-result-update'
import type { CardDetail } from '../card-information/card-calculator'

/**
 * World Link（章节 + Finale）的推荐流程
 * 活动加成只与角色有关：对象角色每张卡固定加成（章节 25%，Finale 5% + 当期卡 25%），
 * 与属性、组合都无关，所以「同色或同组」的剪枝在这里既不成立也没意义。
 * 两类活动的差别只有主卡组的范围，而且已经由 BaseDeckRecommend 按 eventUnit 过滤好了：
 * 1. 旧 WL（单组合章节）：主卡组本身就锁在一个组合里，直接在组合内搜索；
 * 2. 混合 WL（2026 起）与 Finale：主卡组全角色可用，
 *    跑「全角色搜索（不剪枝）」+「同组合兜底（区域道具的同组合加成在薄卡池下可能更优）」。
 * 两条搜索的候选都先收窄，保证搜索量在 C(33,4)/C(25,4) 量级，卡池再大也不会跑不完。
 */
export class WorldLinkDeckStrategy implements DeckRecommendStrategy {
  /**
   * 全角色搜索的候选上限（26 张 = C(25,4)≈1.3e4 个组合，耗时 0.4s 量级）
   */
  private static readonly SEARCH_CARD_LIMIT = 26

  /**
   * 组合内搜索的候选上限
   * 同组合内只剩区域道具加成，需要多留几张卡才不会被裁剪掉最优组法，
   * 34 张对应 C(33,4)≈4.1e4 个组合，耗时仍在 0.3s 量级
   */
  private static readonly UNIT_SEARCH_CARD_LIMIT = 34

  /**
   * 全角色搜索的剪枝：加成既不看属性也不看组合，不做任何剪枝
   */
  private static readonly anyCard = (): boolean => true

  public recommend (context: DeckRecommendContext): RecommendDeck[] {
    // 主卡组的池子是否跨组合：混合 WL 与 Finale 的 eventUnit 为空
    const crossUnit = context.eventConfig.eventUnit === undefined
    let ans = crossUnit
      ? WorldLinkDeckStrategy.trySearch(context, context.searchCards,
        WorldLinkDeckStrategy.SEARCH_CARD_LIMIT, WorldLinkDeckStrategy.anyCard, 'all-character')
      : WorldLinkDeckStrategy.trySearch(context, context.searchCards,
        WorldLinkDeckStrategy.UNIT_SEARCH_CARD_LIMIT, DeckSearch.sameAttrOrUnit, 'unit')
    // 跨组合时再跑一遍同组合兜底：薄卡池里区域道具的同组合加成可能反超
    const supportUnit = context.eventConfig.worldBloomSupportUnit
    if (crossUnit && supportUnit !== undefined) {
      const unitCards = context.searchCards.filter(it =>
        (it.units.length === 1 && it.units[0] === 'piapro') || it.units.includes(supportUnit))
      if (unitCards.length >= context.member) {
        const unit = WorldLinkDeckStrategy.trySearch(context, unitCards,
          WorldLinkDeckStrategy.UNIT_SEARCH_CARD_LIMIT, DeckSearch.sameAttrOrUnit, 'support-unit')
        ans = updateDeck(ans, unit, context.limit)
      }
    }
    if (ans.length === 0) {
      throw new Error(`Cannot recommend any deck in ${context.searchCards.length} cards`)
    }
    return ans
  }

  /**
   * 收窄候选后搜索，组不出卡组时返回空数组（另一条搜索可能还有解）
   * @param context 推荐输入
   * @param cards 候选卡牌
   * @param limit 候选数量上限
   * @param canAddToDeck 剪枝规则
   * @param label 日志用名字
   * @private
   */
  private static trySearch (
    context: DeckRecommendContext, cards: CardDetail[], limit: number,
    canAddToDeck: (leader: CardDetail, card: CardDetail) => boolean, label: string
  ): RecommendDeck[] {
    try {
      return DeckSearch.search(CardCandidates.top(cards, limit, context.member),
        createSearchConfig(context, canAddToDeck), context.debugLog)
    } catch (e) {
      context.debugLog(`World Link ${label} deck not found: ${(e as Error).message}`)
      return []
    }
  }
}
