import { type DataProvider } from '../common/data-provider'
import { type Card } from '../master-data/card'
import { type GameCharacter } from '../master-data/game-character'
import { findOrThrow } from '../util/array-util'
import { CardPowerCalculator } from './card-power-calculator'
import { CardSkillCalculator } from './card-skill-calculator'

export class CardCalculator {
  private readonly powerCalculator: CardPowerCalculator
  private readonly skillCalculator: CardSkillCalculator
  public constructor (private readonly dataProvider: DataProvider) {
    this.powerCalculator = new CardPowerCalculator(dataProvider)
    this.skillCalculator = new CardSkillCalculator(dataProvider)
  }

  /**
   * 获得卡牌组合信息（包括原始组合与应援组合）
   * @param card 卡牌
   * @private
   */
  private async getCardUnits (card: Card): Promise<string[]> {
    const gameCharacters = await this.dataProvider.getMasterData('gameCharacters') as GameCharacter[]
    // 组合（V家支援组合、角色原始组合）
    const units = [] as string[]
    if (card.supportUnit !== 'none') units.push(card.supportUnit)
    units.push(findOrThrow(gameCharacters, it => it.id === card.characterId).unit)
    return units
  }
}

/**
 * 计算过程中使用的卡牌详情信息
 */
export interface CardDetail {
  units: string[]
  attr: string
  power: CardDetailMap
  scoreSkill: CardDetailMap
  lifeSkill: number
  eventBonus: number
}

/**
 * 用于记录在不同的同组合、同属性加成的情况下的综合力或加分技能
 */
export class CardDetailMap {
  public min = Number.MAX_SAFE_INTEGER
  public max = Number.MIN_SAFE_INTEGER
  public values = new Map<string, number>()

  /**
   * 设定给定情况下的值
   * 为了减少内存消耗，人数并非在所有情况下均为实际值，可能会用1代表混组
   * @param unit 特定卡牌组合（虚拟歌手卡牌可能存在两个组合）
   * @param unitMember 该组合对应的人数（用于受组合影响的技能时，1-5、其他情况，5人为同组、1人为混组或无影响）
   * @param attrMember 卡牌属性对应的人数（5人为同色、1人为混色或无影响）
   * @param value 设定的值
   */
  public set (unit: string, unitMember: number, attrMember: number, value: number): void {
    this.min = Math.min(this.min, value)
    this.max = Math.max(this.max, value)
    this.values.set(CardDetailMap.getKey(unit, unitMember, attrMember), value)
  }

  /**
   * 获取给定情况下的值
   * 会返回最合适的值，如果给定的条件与卡牌完全不符会给出异常
   * @param unit 特定卡牌组合（虚拟歌手卡牌可能存在两个组合）
   * @param unitMember 该组合对应的人数（真实值）
   * @param attrMember 卡牌属性对应的人数（真实值）
   */
  public get (unit: string, unitMember: number, attrMember: number): number {
    // 因为实际上的attrMember取值只能是5和1，直接优化掉
    const attrMember0 = attrMember === 5 ? 5 : 1
    let best = this.getInternal(unit, unitMember, attrMember0)
    if (best !== undefined) return best
    // 有可能unitMember在混组的时候优化成1了
    best = this.getInternal(unit, unitMember === 5 ? 5 : 1, attrMember0)
    if (best !== undefined) return best
    // 有可能因为技能是固定数值，attrMember、unitMember都优化成1了，组合直接为any
    best = this.getInternal('any', 1, 1)
    if (best !== undefined) return best
    // 如果这还找不到，说明给的情况就不对
    throw new Error('case not found')
  }

  private getInternal (unit: string, unitMember: number, attrMember: number): number | undefined {
    return this.values.get(CardDetailMap.getKey(unit, unitMember, attrMember))
  }

  /**
   * 实际用于Map的key，用于内部调用避免创建对象的开销
   * @param unit 组合
   * @param unitMember 组合人数
   * @param attrMember 属性人数
   * @private
   */
  public static getKey (unit: string, unitMember: number, attrMember: number): string {
    return `${unit}-${unitMember}-${attrMember}`
  }

  /**
   * 是否肯定比另一个范围小
   * 如果几个维度都比其他小，这张卡可以在自动组卡时舍去
   * @param another 另一个范围
   */
  public isCertainlyLessThen (another: CardDetailMap): boolean {
    // 如果自己最大值比别人最小值还要小，说明自己肯定小
    return this.max < another.min
  }
}
