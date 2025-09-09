import { type DataProvider } from '../data-provider/data-provider'
import { type UserCard } from '../user-data/user-card'
import { type Card } from '../master-data/card'
import { findOrThrow } from '../util/collection-util'
import { type WorldBloomSupportDeckBonus } from '../master-data/world-bloom-support-deck-bonus'
import { type EventConfig } from './event-service'
import {
  type WorldBloomSupportDeckUnitEventLimitedBonus
} from '../master-data/world-bloom-support-deck-unit-event-limited-bonus'

export class CardBloomEventCalculator {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获取单张卡牌的支援加成
   * 需要注意的是，普通World Link支援卡组只能上活动组合的卡，其它卡上不了（Finale为全卡）
   * @param userCard 用户卡牌
   * @param card 卡牌
   * @param units 卡牌对应组合
   * @param eventId 活动ID
   * @param eventUnit 箱活团队
   * @param specialCharacterId 指定的加成角色（正常为篇章角色，Finale为队长角色）
   */
  public async getCardSupportDeckBonus (userCard: UserCard, card: Card, units: string[], {
    eventId = 0,
    eventUnit,
    specialCharacterId = 0
  }: EventConfig): Promise<number | undefined> {
    // 未指定角色的话，不使用支援加成
    if (specialCharacterId <= 0) return undefined

    // 普通的World Link需要先判断一张卡牌是否是指定组合，如果不是的话不使用支援加成
    // 如果是World Link Finale的非混活，所有卡都能当职员卡
    if (eventUnit !== undefined && !units.includes(eventUnit)) {
      return undefined
    }

    // 获得稀有度对应的加成
    const worldBloomSupportDeckBonuses =
      await this.dataProvider.getMasterData<WorldBloomSupportDeckBonus>('worldBloomSupportDeckBonuses')
    const bonus = findOrThrow(worldBloomSupportDeckBonuses,
      it => it.cardRarityType === card.cardRarityType)
    let total = 0

    // 角色加成
    const type =
      card.characterId === specialCharacterId ? 'specific' : 'others'
    total += findOrThrow(bonus.worldBloomSupportDeckCharacterBonuses,
      it => it.worldBloomSupportDeckCharacterType === type).bonusRate
    // 专精等级加成
    total += findOrThrow(bonus.worldBloomSupportDeckMasterRankBonuses,
      it => it.masterRank === userCard.masterRank).bonusRate
    // 技能等级加成
    total += findOrThrow(bonus.worldBloomSupportDeckSkillLevelBonuses,
      it => it.skillLevel === userCard.skillLevel).bonusRate

    // 4.5周年，新增了上一期WL卡牌额外加成
    // World Link Finale会加成上一年的组合限定卡
    const worldBloomSupportDeckUnitEventLimitedBonuses =
        await this.dataProvider.getMasterData<WorldBloomSupportDeckUnitEventLimitedBonus>('worldBloomSupportDeckUnitEventLimitedBonuses')
    const cardBonus = worldBloomSupportDeckUnitEventLimitedBonuses
      .find(it => it.eventId === eventId && it.gameCharacterId === specialCharacterId && it.cardId === card.id)
    if (cardBonus !== undefined) {
      total += cardBonus.bonusRate
    }
    return total
  }
}
