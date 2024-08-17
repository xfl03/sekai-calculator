import { type DataProvider } from '../data-provider/data-provider'
import { type Card } from '../master-data/card'
import { type EventDeckBonus } from '../master-data/event-deck-bonus'
import { type GameCharacterUnit } from '../master-data/game-character-unit'
import { findOrThrow } from '../util/collection-util'
import { type UserCard } from '../user-data/user-card'
import { type EventCard } from '../master-data/event-card'
import { type EventRarityBonusRate } from '../master-data/event-rarity-bonus-rate'

export class CardEventCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获取卡牌的角色、属性加成
   * @param eventId 活动ID
   * @param card 卡牌
   * @private
   */
  private async getEventDeckBonus (eventId: number, card: Card): Promise<number> {
    const eventDeckBonuses = await this.dataProvider.getMasterData<EventDeckBonus>('eventDeckBonuses')
    const gameCharacterUnits = await this.dataProvider.getMasterData<GameCharacterUnit>('gameCharacterUnits')
    return eventDeckBonuses.filter(it =>
      it.eventId === eventId &&
      (it.cardAttr === undefined || it.cardAttr === card.attr))
      .reduce((v, eventDeckBonus) => {
        // 无指定角色
        if (eventDeckBonus.gameCharacterUnitId === undefined) return Math.max(v, eventDeckBonus.bonusRate)

        const gameCharacterUnit = findOrThrow(gameCharacterUnits,
          unit => unit.id === eventDeckBonus.gameCharacterUnitId)

        // 角色不匹配
        if (gameCharacterUnit.gameCharacterId !== card.characterId) return v

        // 非虚拟歌手或者组合正确的虚拟歌手，享受全量加成
        if (card.characterId < 21 || card.supportUnit === gameCharacterUnit.unit) {
          return Math.max(v, eventDeckBonus.bonusRate)
        }

        // 无应援组合的虚拟歌手享受25%加成，有应援组合但不匹配的无加成
        return Math.max(v, card.supportUnit === 'none' ? eventDeckBonus.bonusRate : 0)
      }, 0)
  }

  /**
   * 获取单一卡牌的活动加成（含角色、属性、当期、突破加成）
   * 返回值用到的时候还得/100
   * @param userCard 用户卡牌
   * @param eventId 活动ID
   */
  public async getCardEventBonus (userCard: UserCard, eventId: number): Promise<number> {
    const cards = await this.dataProvider.getMasterData<Card>('cards')
    const eventCards = await this.dataProvider.getMasterData<EventCard>('eventCards')
    const eventRarityBonusRates = await this.dataProvider.getMasterData<EventRarityBonusRate>('eventRarityBonusRates')

    // 计算角色、属性加成
    let eventBonus = 0
    const card = findOrThrow(cards, it => it.id === userCard.cardId)
    eventBonus += await this.getEventDeckBonus(eventId, card)

    // 计算当期卡牌加成
    const cardBonus = eventCards.find((it: any) => it.eventId === eventId && it.cardId === card.id)
    if (cardBonus != null) {
      eventBonus += cardBonus.bonusRate
    }

    // 计算突破等级加成
    const masterRankBonus = findOrThrow(eventRarityBonusRates,
      it => it.cardRarityType === card.cardRarityType && it.masterRank === userCard.masterRank)
    eventBonus += masterRankBonus.bonusRate

    // 实际使用的时候还得/100
    return eventBonus
  }
}
