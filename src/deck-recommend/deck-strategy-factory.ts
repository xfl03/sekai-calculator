import { LiveType } from '../live-score/live-calculator'
import { EventType, type EventConfig } from '../event-point/event-service'
import { MemoriesDeckStrategy } from './memories-deck-strategy'
import { NormalDeckStrategy } from './normal-deck-strategy'
import { WorldLinkDeckStrategy } from './world-link-deck-strategy'
import type { DeckRecommendStrategy } from './deck-strategy'

/**
 * 根据活动和 Live 类型选择推荐策略
 * 1. World Link（章节与 Finale 同一套逻辑）：加成只与角色有关，不按属性/组合剪枝，
 *    主卡组范围由 eventUnit 决定（旧 WL 单组合章节 / 混合 WL 与 Finale 全角色）；
 * 2. 加成与属性无关的活动（Memories）：同色 + 混色双搜索；
 * 3. 其他（含挑战Live）：普通的优先级筛选 + 递归搜索。
 * @param liveType Live类型
 * @param eventConfig 活动配置
 */
export function createDeckRecommendStrategy (
  liveType: LiveType, eventConfig: EventConfig
): DeckRecommendStrategy {
  // 挑战Live的卡牌可以重复上场，活动加成规则也不适用，一律走普通流程
  if (liveType !== LiveType.CHALLENGE) {
    if (eventConfig.eventType === EventType.BLOOM) return new WorldLinkDeckStrategy()
    if (eventConfig.attrIndependentBonus === true) return new MemoriesDeckStrategy()
  }
  return new NormalDeckStrategy()
}
