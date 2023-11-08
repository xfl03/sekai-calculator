import { type DataProvider } from '../data-provider/data-provider'
import { type Event } from '../master-data/event'
import { findOrThrow } from '../util/collection-util'
import { type EventDeckBonus } from '../master-data/event-deck-bonus'
import { type GameCharacterUnit } from '../master-data/game-character-unit'

export class EventService {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获取活动类型
   * @param eventId 活动ID
   */
  public async getEventType (eventId: number): Promise<EventType> {
    const events = await this.dataProvider.getMasterData<Event>('events')
    const event = findOrThrow(events, it => it.id === eventId)
    switch (event.eventType) {
      case 'marathon':
        return EventType.MARATHON
      case 'cheerful_carnival':
        return EventType.CHEERFUL
      case 'world_bloom':
        return EventType.BLOOM
      default:
        throw new Error(`Event type ${event.eventType} not found.`)
    }
  }

  /**
   * 获取活动设置
   * @param eventId 活动ID
   * @param specialCharacterId 特别选择的角色ID（用于）
   */
  public async getEventConfig (eventId: number, specialCharacterId?: number): Promise<EventConfig> {
    return {
      eventId,
      eventType: await this.getEventType(eventId),
      eventUnit: await this.getEventBonusUnit(eventId),
      specialCharacterId
    }
  }

  /**
   * 获取箱活的加成团队
   * 如果非箱活，会返回undefined
   * @param eventId 活动ID
   */
  public async getEventBonusUnit (eventId: number): Promise<string | undefined> {
    const eventDeckBonuses =
      await this.dataProvider.getMasterData<EventDeckBonus>('eventDeckBonuses')
    const gameCharacterUnits =
      await this.dataProvider.getMasterData<GameCharacterUnit>('gameCharacterUnits')
    const set = new Set<string>()
    eventDeckBonuses
      .filter(it => it.eventId === eventId && it.gameCharacterUnitId !== undefined)
      .map(it =>
        findOrThrow(gameCharacterUnits, a => a.id === it.gameCharacterUnitId))
      .forEach(it => set.add(it.unit))
    if (set.size !== 1) return undefined
    return Array.from(set)[0]
  }
}

/**
 * 活动类型
 */
export enum EventType {
  NONE = 'none',
  MARATHON = 'marathon',
  CHEERFUL = 'cheerful_carnival',
  BLOOM = 'world_bloom',
}

/**
 * 活动信息设置
 */
export interface EventConfig {
  eventId?: number
  eventType?: EventType
  /**
   * 箱活的团队
   */
  eventUnit?: string
  /**
   * 特殊角色ID，用于世界开花活动
   */
  specialCharacterId?: number
}
