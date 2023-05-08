import { type RecommendDeck } from './base-deck-recommend'

/**
 * 按分数倒序、综合倒序、C位CardID正序的顺序排序推荐卡组
 * @param deck1 卡组1
 * @param deck2 卡组2
 */
function compareDeck (deck1: RecommendDeck, deck2: RecommendDeck): number {
  // 先按分数倒序
  if (deck1.score !== deck2.score) return deck2.score - deck1.score
  // 分数一样，按综合倒序
  if (deck1.power !== deck2.power) return deck2.power.total - deck1.power.total
  // 分数、综合一样，按C位CardID正序
  return deck1.deckCards[0].cardId - deck2.deckCards[0].cardId
}

/**
 * 去除相同卡组
 * 复杂度O(n)，需要先排序一下
 * @param it 当前卡组
 * @param i 索引
 * @param arr 所有卡组
 */
function removeSameDeck (it: RecommendDeck, i: number, arr: RecommendDeck[]): boolean {
  // 第一个位置 没法排除
  if (i === 0) return true
  const pre = arr[i - 1]
  // 如果分数或者综合不一样，说明肯定不是同一队
  if (pre.score !== it.score || pre.power !== it.power) return true
  // 如果C位不一样，也不认为是同一队
  return pre.deckCards[0].cardId !== it.deckCards[0].cardId
}

/**
 * 排序、去重、限制卡组数量
 * 复杂度O(nlogn)
 * @param pre 之前的推荐
 * @param result 新的推荐
 * @param limit 数量限制
 */
export function updateDeck (pre: RecommendDeck[], result: RecommendDeck[], limit: number): RecommendDeck[] {
  // 更新答案，按分数高到低排序可能用个堆来维护更合适）
  let ans = [...pre, ...result].sort(compareDeck)
  // 排除重复答案
  ans = ans.filter(removeSameDeck)
  // 限制答案数量
  if (ans.length > limit) ans = ans.slice(0, limit)
  return ans
}
