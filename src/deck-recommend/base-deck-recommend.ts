import { type DataProvider } from '../data-provider/data-provider'
import { CardCalculator, type CardConfig, type CardDetail } from '../card-information/card-calculator'
import {
  DeckCalculator,
  type DeckDetail
} from '../deck-information/deck-calculator'
import { LiveType } from '../live-score/live-calculator'
import { type UserCard } from '../user-data/user-card'
import { type MusicMeta } from '../common/music-meta'
import { containsAny, swap } from '../util/collection-util'
import { filterCardPriority } from '../card-priority/card-priority-filter'
import { isDeckAttrLessThan3, toRecommendDeck, updateDeck } from './deck-result-update'
import { AreaItemService } from '../area-item-information/area-item-service'
import { type EventConfig, EventType } from '../event-point/event-service'

export class BaseDeckRecommend {
  private readonly cardCalculator: CardCalculator
  private readonly deckCalculator: DeckCalculator
  private readonly areaItemService: AreaItemService

  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
    this.deckCalculator = new DeckCalculator(dataProvider)
    this.areaItemService = new AreaItemService(dataProvider)
  }

  /**
   * 使用递归寻找最佳卡组
   * 栈深度不超过member+1层
   * 复杂度O(n^member)，带大量剪枝
   * （按分数高到低排序）
   * @param cardDetails 参与计算的卡牌
   * @param allCards 全部卡牌（按支援卡组加成排序）
   * @param scoreFunc 获得分数的公式
   * @param limit 需要推荐的卡组数量（按分数高到低）
   * @param isChallengeLive 是否挑战Live（人员可重复）
   * @param member 人数限制（2-5、默认5）
   * @param leaderCharacter C位角色ID
   * @param honorBonus 称号加成
   * @param eventConfig 活动信息
   * @param deckCards 计算过程中的当前卡组
   * @private
   */
  private static findBestCards (
    cardDetails: CardDetail[], allCards: CardDetail[], scoreFunc: (deckDetail: DeckDetail) => number, limit: number = 1,
    isChallengeLive: boolean = false, member: number = 5, leaderCharacter: number = 0, honorBonus: number = 0,
    eventConfig: EventConfig = {},
    deckCards: CardDetail[] = []
  ): RecommendDeck[] {
    // 防止挑战Live卡的数量小于允许上场的数量导致无法组队
    if (isChallengeLive) {
      member = Math.min(member, cardDetails.length)
    }
    // 已经是完整卡组，计算当前卡组的值
    if (deckCards.length === member) {
      const deckDetail = DeckCalculator.getDeckDetailByCards(
        deckCards, allCards, honorBonus, eventConfig.cardBonusCountLimit,
        eventConfig.worldBloomDifferentAttributeBonuses
      )
      const score = scoreFunc(deckDetail)
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
      return BaseDeckRecommend.findBestCards(
        cardDetails, allCards, scoreFunc, limit, isChallengeLive, member, leaderCharacter, honorBonus,
        eventConfig, deckCards)
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
      if (!isChallengeLive && deckCards.some(it => it.characterId === card.characterId)) {
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
      // 为了优化性能，必须和C位同色或同组
      if (deckCards.length >= 1 && card.attr !== deckCards[0].attr && !containsAny(deckCards[0].units, card.units)) {
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
      const result = BaseDeckRecommend.findBestCards(
        cardDetails, allCards, scoreFunc, limit, isChallengeLive, member, leaderCharacter, honorBonus,
        eventConfig, [...deckCards, card])
      ans = updateDeck(ans, result, limit)
    }
    // 在最外层检查一下是否成功组队
    if (deckCards.length === 0 && ans.length === 0) {
      console.warn(`Cannot find deck in ${cardDetails.length} cards(${cardDetails.map(it => it.cardId).toString()})`)
      return []
    }

    // 按分数从高到低排序、限制数量
    return ans
  }

  /**
   * 推荐高分卡组
   * @param userCards 参与推荐的卡牌
   * @param scoreFunc 分数计算公式
   * @param musicMeta 歌曲信息
   * @param limit 需要推荐的卡组数量（按分数高到低）
   * @param member 限制人数（2-5、默认5）
   * @param leaderCharacter C位角色ID（可选）
   * @param cardConfig 卡牌设置
   * @param debugLog 测试日志处理函数
   * @param liveType Live类型
   * @param eventConfig 活动配置
   */
  public async recommendHighScoreDeck (
    userCards: UserCard[], scoreFunc: ScoreFunction,
    {
      musicMeta,
      limit = 1,
      member = 5,
      leaderCharacter = undefined,
      cardConfig = {},
      debugLog = (_: string) => {
      }
    }: DeckRecommendConfig,
    liveType: LiveType,
    eventConfig: EventConfig = {}
  ): Promise<RecommendDeck[]> {
    const { eventType = EventType.NONE, eventUnit, specialCharacterId, worldBloomType, worldBloomSupportUnit } = eventConfig
    const honorBonus = await this.deckCalculator.getHonorBonusPower()
    // 用于计算的卡（主队伍+应援队伍）
    const areaItemLevels = await this.areaItemService.getAreaItemLevels()
    let cards =
        await this.cardCalculator.batchGetCardDetail(userCards, cardConfig, eventConfig, areaItemLevels)
    // 过滤箱活的卡，不上其它组合的
    // 因为World Link应援队伍只能从指定组合选，这里照样可以过滤不影响结果
    let filterUnit = eventUnit
    if (worldBloomSupportUnit !== undefined) {
      // World Link活动，无论主卡组还是应援卡组，都要跟着应援角色组合走
      // 普通World Link活动两者本来就一致，Final为混活（eventUnit为空），此处强制覆盖
      filterUnit = worldBloomSupportUnit
    }
    if (filterUnit !== undefined) {
      const originCardsLength = cards.length
      cards = cards.filter(it =>
        (it.units.length === 1 && it.units[0] === 'piapro') ||
          // 因为filterUnit是一个可变量，这里还需要再次判断（实际无效），不然编译会有问题
          filterUnit === undefined || it.units.includes(filterUnit))
      debugLog(`Cards filtered with unit ${filterUnit}: ${cards.length}/${originCardsLength}`)
      debugLog(cards.map(it => it.cardId).toString())
    }
    // World Link Finale，需要强制指定Leader
    if (worldBloomType === 'finale') {
      leaderCharacter = specialCharacterId
    }

    // 为了优化性能，会根据活动加成和卡牌稀有度优先级筛选卡牌
    let preCardDetails = [] as CardDetail[]
    while (true) {
      const cardDetails =
          filterCardPriority(liveType, eventType, cards, preCardDetails, member, leaderCharacter)
      if (cardDetails.length === preCardDetails.length) {
        // 如果所有卡牌都上阵了还是组不出队伍，就报错
        throw new Error(`Cannot recommend any deck in ${cards.length} cards`)
      }
      preCardDetails = cardDetails
      const cards0 = cardDetails.sort((a, b) => a.cardId - b.cardId)
      debugLog(`Recommend deck with ${cards0.length}/${cards.length} cards `)
      debugLog(cards0.map(it => it.cardId).toString())
      const recommend = BaseDeckRecommend.findBestCards(cards0, cards,
        deckDetail => scoreFunc(musicMeta, deckDetail), limit, liveType === LiveType.CHALLENGE, member,
        leaderCharacter, honorBonus, eventConfig)
      if (recommend.length >= limit) return recommend
    }
  }
}

export type ScoreFunction = (musicMeta: MusicMeta, deckDetail: DeckDetail) => number

export interface RecommendDeck extends DeckDetail {
  score: number
}

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
