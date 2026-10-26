import type { CardConfig } from '../card-information/card-calculator'
import type { DeckDetail } from '../deck-information/deck-calculator'
import type { MusicMeta } from '../common/music-meta'

/**
 * 分数计算公式
 */
export type ScoreFunction = (musicMeta: MusicMeta, deckDetail: DeckDetail) => number

/**
 * 推荐结果
 */
export interface RecommendDeck extends DeckDetail {
  score: number
}

/**
 * 推荐设置
 */
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
   * C位角色ID
   */
  leaderCharacter?: number
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
