import { type DataProvider } from '../common/data-provider'
import { CardCalculator, type CardDetail } from '../deck-information/card-calculator'
import { DeckCalculator } from '../deck-information/deck-calculator'
import { LiveCalculator, type LiveType } from '../live-score/live-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { containsAny, findOrThrow } from '../util/collection-util'
import { EventCalculator } from '../event-point/event-calculator'

export class BaseDeckRecommend {
  private readonly cardCalculator: CardCalculator
  private readonly deckCalculator: DeckCalculator

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.deckCalculator = new DeckCalculator(dataProvider)
  }

  /**
   * 过滤纳入计算的卡牌，排除掉各个维度都不行的卡牌
   * 返回的卡牌按卡牌ID排序
   * @param cardDetails 卡牌详情
   * @private
   */
  private static filterCard (cardDetails: CardDetail[]): CardDetail[] {
    // 根据活动加成，排除掉一些加成较低的卡牌
    let afterFilter = cardDetails
    for (const minBonus of [65, 50, 40, 25, 15, 0]) {
      const bonusFilter = cardDetails.filter(cardDetail =>
        !(cardDetail.eventBonus !== undefined && cardDetail.eventBonus < minBonus))
      if (bonusFilter.length >= 5) {
        afterFilter = bonusFilter
        break
      }
    }
    // console.log(afterFilter.map(it => it.cardId))
    // console.log(`Origin:${cardDetails.length} After:${afterFilter.length}`)
    return afterFilter
  }

  /**
   * 使用递归寻找最佳卡组
   * @param cardDetails 参与计算的卡牌
   * @param scoreFunc 获得分数的公式
   * @param isChallengeLive 是否挑战Live（人员可重复）
   * @param member 人数限制（2-5、默认5）
   * @param deckCards 计算过程中的当前卡组
   * @param deckCharacters 当前卡组的人员
   * @private
   */
  private static findBestCards (
    cardDetails: CardDetail[], scoreFunc: (deckCards: CardDetail[]) => number, isChallengeLive: boolean = false,
    member: number = 5, deckCards: CardDetail[] = [], deckCharacters: number[] = []
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
    let preCard = cardDetails[0]
    for (const card of cardDetails) {
      // 跳过已经重复出现过的卡牌
      if (deckCards.includes(card)) continue
      // 跳过重复角色
      if (!isChallengeLive && deckCharacters.includes(card.characterId)) continue
      // C位一定是技能最好的卡牌，跳过技能比C位还好的
      if (deckCards.length >= 1 && deckCards[0].scoreSkill.isCertainlyLessThen(card.scoreSkill)) continue
      // 为了优化性能，必须和C位同色或同组
      if (deckCards.length >= 1 && card.attr !== deckCards[0].attr && !containsAny(deckCards[0].units, card.units)) {
        continue
      }
      // 如果比上一次选定的卡牌要弱，那么舍去，让这张卡去后面再选
      if (CardCalculator.isCertainlyLessThan(card, preCard)) continue
      preCard = card
      // 递归，寻找所有情况
      const result = BaseDeckRecommend.findBestCards(
        cardDetails, scoreFunc, isChallengeLive, member,
        [...deckCards, card], [...deckCharacters, card.characterId])
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
   * @param eventId 活动ID（如果要计算活动PT的话）
   * @param isChallengeLive 是否挑战Live（人员可重复）
   * @param member 限制人数（2-5、默认5）
   */
  public async recommendHighScoreDeck (
    userCards: UserCard[], musicId: number, musicDiff: string, scoreFunc: ScoreFunction, eventId: number = 0,
    isChallengeLive: boolean = false, member: number = 5
  ): Promise<{ score: number, deckCards: UserCard[] }> {
    const musicMetas = await this.dataProvider.getMusicMeta() as MusicMeta[]
    const musicMeta = findOrThrow(musicMetas, it => it.music_id === musicId && it.difficulty === musicDiff)
    const cardDetails = BaseDeckRecommend.filterCard(await this.cardCalculator.batchGetCardDetail(userCards, eventId))
    const honorBonus = await this.deckCalculator.getHonorBonusPower()
    // console.log(`All:${userCards.length}, used:${cardDetails.length}`)
    const best = BaseDeckRecommend.findBestCards(cardDetails,
      deckCards => scoreFunc(musicMeta, honorBonus, deckCards), isChallengeLive, member)
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
      LiveCalculator.getLiveScoreByDeck(deckCards, honorBonus, musicMeta, liveType)
  }

  /**
   * 获取计算活动PT的函数
   * @param liveType Live类型
   */
  public static getEventPointFunction (liveType: LiveType): ScoreFunction {
    return (musicMeta, honorBonus, deckCards) =>
      EventCalculator.getDeckEventPoint(deckCards, honorBonus, musicMeta, liveType)
  }
}

export type ScoreFunction = (musicMeta: MusicMeta, honorBonus: number, deckCards: CardDetail[]) => number
