import { type DataProvider } from '../common/data-provider'
import { LiveCalculator, LiveType } from '../live-score/live-calculator'
import { type MusicMeta } from '../common/music-meta'
import { DeckCalculator, type DeckDetail } from '../deck-information/deck-calculator'
import { EventCalculator } from '../event-point/event-calculator'

export class MusicRecommend {
  private readonly deckCalculator: DeckCalculator
  public constructor (private readonly dataProvider: DataProvider) {
    this.deckCalculator = new DeckCalculator(dataProvider)
  }

  /**
   * 获取一首歌曲的分数、活动PT
   * @param deck 卡组
   * @param musicMeta 歌曲信息
   * @param liveTypes 计算的Live类型
   * @private
   */
  private getRecommendMusic (
    deck: DeckDetail, musicMeta: MusicMeta, liveTypes: LiveType[] = [LiveType.SOLO, LiveType.MULTI, LiveType.AUTO]
  ): RecommendMusic {
    const liveScore = new Map<LiveType, number>()
    const eventPoint = new Map<LiveType, number>()
    const deckBonus = deck.eventBonus
    for (const liveType of liveTypes) {
      const score = LiveCalculator.getLiveDetailByDeck(deck, musicMeta, liveType).score
      liveScore.set(liveType, score)
      // 挑战Live或者有计算加成的话，就算一下活动PT
      if (deck.eventBonus !== undefined || liveType === LiveType.CHALLENGE) {
        const point = EventCalculator.getEventPoint(liveType, score, musicMeta.event_rate, deckBonus)
        eventPoint.set(liveType, point)
      }
    }
    return {
      musicId: musicMeta.music_id,
      difficulty: musicMeta.difficulty,
      liveScore,
      eventPoint
    }
  }

  /**
   * 根据卡组，获取歌曲分数与活动PT
   * @param deck 卡组
   * @param liveTypes 计算的Live类型
   */
  public async recommendMusic (
    deck: DeckDetail, liveTypes: LiveType[] = [LiveType.SOLO, LiveType.MULTI, LiveType.AUTO]
  ): Promise<RecommendMusic[]> {
    const musicMetas = await this.dataProvider.getMusicMeta() as MusicMeta[]
    return musicMetas.map(it => this.getRecommendMusic(deck, it, liveTypes))
  }
}

interface RecommendMusic {
  musicId: number
  difficulty: string
  liveScore: Map<LiveType, number>
  eventPoint: Map<LiveType, number>
}
