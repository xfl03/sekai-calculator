// import type UserCard from '../user-data/user-card'
// import type Card from '../master-data/card'
// import type AreaItemLevel from '../master-data/area-item-level'
// import type UserCharacter from '../user-data/user-character'

/**
 * 计算过程中使用的卡牌详情信息
 */
export class CardDetail {
  public constructor (
    public units: string[], public attr: string,
    public power: CardDetailMap, public skill: CardDetailMap, public eventBonus?: number
  ) {
  }

  // public static fromCard (userCard: UserCard, card: Card, areaItemLevels: AreaItemLevel[], userCharacters: UserCharacter[]): CardDetail {
  //
  // }
}

/**
 * 用于记录在不同的同组合、同属性加成的情况下的综合力或加分技能
 */
class CardDetailMap {
  public min = Number.MAX_SAFE_INTEGER
  public max = Number.MIN_SAFE_INTEGER
  public values = new Map<string, number>()

  public set (unit: string, attr: string, value: number): void {
    this.min = Math.min(this.min, value)
    this.max = Math.max(this.max, value)
    this.values.set(CardDetailMap.getKey(unit, attr), value)
  }

  public get (unit: string, attr: string): number | undefined {
    return this.values.get(CardDetailMap.getKey(unit, attr))
  }

  public static getKey (unit: string, attr: string): string {
    return `${unit}-${attr}`
  }

  /**
     * 是否肯定比另一个范围小
     * 如果几个维度都比其他小，这张卡可以舍去
     * @param another 另一个范围
     */
  public isCertainlyLessThen (another: CardDetailMap): boolean {
    // 如果自己最大值比别人最小值还要小，说明自己肯定小
    return this.max < another.min
  }
}
