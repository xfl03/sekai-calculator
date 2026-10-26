import type { CardDetail } from '../card-information/card-calculator'
import type { MusicMeta } from '../common/music-meta'
import type { EventConfig, EventType } from '../event-point/event-service'
import type { LiveType } from '../live-score/live-calculator'
import type { RecommendDeck, ScoreFunction } from './deck-recommend-type'

/**
 * 一次卡组推荐的输入
 * 公共流程（读卡、过滤、锁 C 位）在 BaseDeckRecommend 里做完后交给具体策略
 */
export interface DeckRecommendContext {
  /**
   * 参与计算的全部卡牌（用于应援卡组加成，必须保持全量）
   */
  allCards: CardDetail[]
  /**
   * 参与搜索的候选卡牌
   */
  searchCards: CardDetail[]
  /**
   * 分数公式
   */
  scoreFunc: ScoreFunction
  /**
   * 歌曲信息
   */
  musicMeta: MusicMeta
  /**
   * 需要推荐的卡组数量
   */
  limit: number
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
   * 日志处理函数
   */
  debugLog: (str: string) => void
}

/**
 * 卡组推荐策略
 * 不同活动的活动加成规则不同，剪枝方式和候选收窄方式也不同，
 * 所以拆成独立实现：普通活动、属性无关活动（Memories）、World Link Finale
 */
export interface DeckRecommendStrategy {
  /**
   * 推荐卡组
   * @param context 推荐输入
   */
  recommend (context: DeckRecommendContext): RecommendDeck[]
}
