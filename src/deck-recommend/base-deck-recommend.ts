import type { DataProvider } from '../data-provider/data-provider'
import { CardCalculator } from '../card-information/card-calculator'
import { DeckCalculator } from '../deck-information/deck-calculator'
import type { LiveType } from '../live-score/live-calculator'
import type { UserCard } from '../user-data/user-card'
import { AreaItemService } from '../area-item-information/area-item-service'
import { EventType, type EventConfig } from '../event-point/event-service'
import { createDeckRecommendStrategy } from './deck-strategy-factory'
import type { DeckRecommendContext } from './deck-strategy'
import type { DeckRecommendConfig, RecommendDeck, ScoreFunction } from './deck-recommend-type'

export type { RecommendDeck, ScoreFunction, DeckRecommendConfig } from './deck-recommend-type'

/**
 * 卡组推荐入口
 * 只负责公共流程：读卡牌详情、按活动过滤组合、强制 C 位，
 * 具体怎么搜（普通 / Memories / World Link Finale）交给对应的推荐策略
 */
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
   * 推荐高分卡组
   * @param userCards 参与推荐的卡牌
   * @param scoreFunc 分数计算公式
   * @param config 推荐设置
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
    const { eventType = EventType.NONE, eventUnit, specialCharacterId, worldBloomType } = eventConfig
    const honorBonus = await this.deckCalculator.getHonorBonusPower()
    // 用于计算的卡（主队伍+应援队伍）
    const areaItemLevels = await this.areaItemService.getAreaItemLevels()
    let cards =
        await this.cardCalculator.batchGetCardDetail(userCards, cardConfig, eventConfig, areaItemLevels)
    // 过滤箱活的卡：箱活/旧 World Link 章节的主卡组只能上活动组合的卡
    // 混合 World Link（2026 起）与 Finale 的 eventUnit 为空，主卡组全角色可用，不做过滤
    if (eventUnit !== undefined) {
      const originCardsLength = cards.length
      const filterUnit = eventUnit
      cards = cards.filter(it =>
        (it.units.length === 1 && it.units[0] === 'piapro') || it.units.includes(filterUnit))
      debugLog(`Cards filtered with unit ${filterUnit}: ${cards.length}/${originCardsLength}`)
      debugLog(cards.map(it => it.cardId).toString())
    }
    // World Link Finale，需要强制指定Leader
    if (worldBloomType === 'finale') {
      leaderCharacter = specialCharacterId
    }
    const context: DeckRecommendContext = {
      allCards: cards,
      searchCards: cards,
      scoreFunc,
      musicMeta,
      limit,
      member,
      leaderCharacter: leaderCharacter ?? 0,
      honorBonus,
      liveType,
      eventType,
      eventConfig,
      debugLog
    }
    return createDeckRecommendStrategy(liveType, eventConfig).recommend(context)
  }
}
