import { type DataProvider } from '../common/data-provider'
import { CardCalculator, type CardDetail } from '../deck-information/card-calculator'
import { DeckCalculator } from '../deck-information/deck-calculator'
import { LiveCalculator, type LiveType } from '../live-score/live-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { findOrThrow } from '../util/collection-util'

export class BaseDeckRecommend {
  private readonly cardCalculator: CardCalculator
  private readonly deckCalculator: DeckCalculator
  private readonly liveCalculator: LiveCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.deckCalculator = new DeckCalculator(dataProvider)
    this.liveCalculator = new LiveCalculator(dataProvider)
  }

  /**
   * 过滤纳入计算的卡牌，排除掉各个维度都不行的卡牌
   * 返回的卡牌按卡牌ID排序
   * @param cardDetails 卡牌详情
   * @private
   */
  private static filterCard (cardDetails: CardDetail[]): CardDetail[] {
    // 两两比较，只要有一张卡综合、技能都肯定比它强，就排除掉这张卡
    const afterFilter = cardDetails.filter(cardDetail => {
      for (const anotherCardDetail of cardDetails) {
        if (CardCalculator.isCertainlyLessThan(cardDetail, anotherCardDetail)) return false
      }
      return true
    })
    // console.log(`Origin:${cardDetails.length} After:${afterFilter.length}`)
    // 如果筛选完只剩不到5张卡的话，那就甭筛选了
    return (afterFilter.length < 5 ? cardDetails : afterFilter)
      .sort((a, b) => a.cardId - b.cardId)
  }

  /**
   * 使用递归寻找最佳卡组
   * @param cardDetails 参与计算的卡牌
   * @param scoreFunc 获得分数的公式
   * @param member 人数限制（2-5、默认5）
   * @param deckCards 计算过程中的当前卡组
   * @private
   */
  private static findBestCards (
    cardDetails: CardDetail[], scoreFunc: (deckCards: CardDetail[]) => number,
    member: number = 5, deckCards: CardDetail[] = []
  ): { score: number, deckCards: CardDetail[] } {
    // 已经是完整卡组，计算当前卡组的值
    if (deckCards.length === member) {
      return {
        score: scoreFunc(deckCards),
        deckCards
      }
    }
    // 非完整卡组，继续遍历所有情况
    let ans = {
      score: 0,
      deckCards: cardDetails
    }
    for (const card of cardDetails) {
      // 跳过已经重复出现过的卡牌
      if (deckCards.includes(card)) continue
      // C位一定是技能最好的卡牌，跳过技能比C位还好的
      if (deckCards.length >= 1 && deckCards[0].scoreSkill.isCertainlyLessThen(card.scoreSkill)) continue
      // 因为后面4个卡牌完全等价，要求按照卡牌ID顺序排序，减少重复情况
      if (deckCards.length >= 2 && card.cardId < deckCards[deckCards.length - 1].cardId) continue
      // 递归，寻找所有情况
      const result = BaseDeckRecommend.findBestCards(cardDetails, scoreFunc, member, [...deckCards, card])
      // 更新答案
      if (result.score > ans.score) ans = result
    }
    return ans
  }

  /**
   * 推荐高分卡组
   * @param userCards 参与推荐的卡牌
   * @param musicId 歌曲ID
   * @param musicDiff 歌曲难度
   * @param scoreFunc 分数计算公式
   * @param member 限制人数（2-5、默认5）
   */
  public async recommendHighScoreDeck (
    userCards: UserCard[], musicId: number, musicDiff: string, scoreFunc: ScoreFunction, member: number = 5
  ): Promise<{ score: number, deckCards: UserCard[] }> {
    const musicMetas = await this.dataProvider.getMusicMeta() as MusicMeta[]
    const musicMeta = findOrThrow(musicMetas, it => it.music_id === musicId && it.difficulty === musicDiff)
    const cardDetails = BaseDeckRecommend.filterCard(await this.cardCalculator.batchGetCardDetail(userCards))
    const honorBonus = await this.deckCalculator.getHonorBonusPower()
    const best = BaseDeckRecommend.findBestCards(cardDetails,
      deckCards => scoreFunc(musicMeta, honorBonus, deckCards), member)
    return {
      score: best.score,
      deckCards: best.deckCards.map(deckCard => findOrThrow(userCards, it => it.cardId === deckCard.cardId))
    }
  }

  /**
   * 获取计算歌曲分数的函数
   * @param liveType Live类型
   */
  public static getLiveScoreFunction (liveType: LiveType): ScoreFunction {
    return (musicMeta, honorBonus, deckCards) =>
      LiveCalculator.getLiveDetailByDeck(
        DeckCalculator.getDeckDetailByCards(deckCards, honorBonus), musicMeta, liveType).score
  }
}

export type ScoreFunction = (musicMeta: MusicMeta, honorBonus: number, deckCards: CardDetail[]) => number
