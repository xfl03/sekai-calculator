import { type DataProvider } from '../data-provider/data-provider'
import { type Event } from '../master-data/event'
import { findOrThrow } from '../util/collection-util'

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
      case 'world_bloom': // TODO 还不知道会叫什么，先随便写一个
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
      specialCharacterId
    }
  }
}

/**
 * 活动类型
 */
export enum EventType {
  NONE = 'none',
  MARATHON = 'marathon',
  CHEERFUL = 'cheerful_carnival',
  BLOOM = 'world_bloom', // TODO 还不知道会叫什么，先随便写一个
}

/**
 * 活动信息设置
 */
export interface EventConfig {
  eventId?: number
  eventType?: EventType
  /**
   * 特殊角色ID，用于
   */
  specialCharacterId?: number
}
