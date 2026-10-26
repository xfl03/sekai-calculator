import { createSearchConfig, DeckSearch } from './deck-search'
import type { DeckRecommendContext, DeckRecommendStrategy } from './deck-strategy'
import type { RecommendDeck } from './deck-recommend-type'

/**
 * 普通活动的推荐流程（马拉松、欢乐嘉年华、World Link 章节、挑战Live 等）
 * 优先级筛选 + 递归搜索，剪枝规则是「和 C 位同色或同组」
 */
export class NormalDeckStrategy implements DeckRecommendStrategy {
  public recommend (context: DeckRecommendContext): RecommendDeck[] {
    return DeckSearch.search(context.searchCards,
      createSearchConfig(context, DeckSearch.sameAttrOrUnit), context.debugLog)
  }
}
