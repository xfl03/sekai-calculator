import { CardCandidates } from './card-candidates'
import { createSearchConfig, DeckSearch } from './deck-search'
import type { DeckRecommendContext, DeckRecommendStrategy } from './deck-strategy'
import type { RecommendDeck } from './deck-recommend-type'
import { updateDeck } from './deck-result-update'
import type { CardDetail } from '../card-information/card-calculator'

/**
 * 活动加成与属性无关的活动（例如 Memories）的推荐流程
 * 同时跑「同色」和「混色」两种搜索，取更优的结果：
 * 1. 活动加成与颜色无关，但区域道具仍有同色加成，所以同色通常是更优的，而且同色剪枝能把搜索压下来；
 * 2. 但最强卡分散在不同颜色时，混色可能反超，所以每人留几张卡再搜一遍混色兜底。
 */
export class MemoriesDeckStrategy implements DeckRecommendStrategy {
  /**
   * 每个角色每种属性保留的卡牌数量（同色搜索）
   */
  private static readonly CARD_LIMIT = 2

  /**
   * 每个角色保留的卡牌数量（混色兜底搜索）
   */
  private static readonly MIXED_CARD_LIMIT = 2

  public recommend (context: DeckRecommendContext): RecommendDeck[] {
    let ans: RecommendDeck[] = []
    // 同色搜索：每人每色留最强 2 张，只看同色
    const monoCards = CardCandidates.perCharacterAndAttr(context.searchCards,
      MemoriesDeckStrategy.CARD_LIMIT)
    if (CardCandidates.canMakeAttrDeck(monoCards, context.member)) {
      try {
        ans = DeckSearch.search(monoCards,
          createSearchConfig(context, MemoriesDeckStrategy.sameAttr), context.debugLog)
      } catch (e) {
        context.debugLog(`Mono attr deck not found: ${(e as Error).message}`)
      }
    }
    // 混色兜底：每人只留最强 2 张，不强制同色
    const mixedCards = CardCandidates.perCharacter(context.searchCards,
      MemoriesDeckStrategy.MIXED_CARD_LIMIT)
    try {
      const mixed = DeckSearch.search(mixedCards,
        createSearchConfig(context, DeckSearch.sameAttrOrUnit), context.debugLog)
      ans = updateDeck(ans, mixed, context.limit)
    } catch (e) {
      context.debugLog(`Mixed deck not found: ${(e as Error).message}`)
    }
    if (ans.length === 0) {
      throw new Error(`Cannot recommend any deck in ${context.searchCards.length} cards`)
    }
    return ans
  }

  /**
   * 同色搜索的剪枝：加成与颜色无关，同色只剩区域道具加成，所以只允许同色
   * @param leader C位卡牌
   * @param card 待加入的卡牌
   */
  private static readonly sameAttr = (leader: CardDetail, card: CardDetail): boolean =>
    card.attr === leader.attr
}
