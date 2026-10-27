import type { DataProvider } from '../data-provider/data-provider'
import type { UserMysekaiCanvas } from '../user-data/user-mysekai-canvas'
import type {
  UserMysekaiFixtureGameCharacterPerformanceBonus
} from '../user-data/user-mysekai-fixture-game-character-performance-bonus'
import type { MysekaiGateLevel } from '../master-data/mysekai-gate-level'
import type { UserMysekaiGate } from '../user-data/user-mysekai-gate'
import type { MysekaiGate } from '../master-data/mysekai-gate'

export class MysekaiService {
  public constructor (private readonly dataProvider: DataProvider) {
  }

  /**
   * 获得带有自定义世界画布加成的卡牌
   * 看上去一个卡牌只有加成和不加成两种状态，直接返回卡牌ID列表
   * 计算逻辑：根据稀有度确定固定加成，不享受区域道具、角色等级加成，享受家具、大门加成
   */
  public async getMysekaiCanvasBonusCards (): Promise<Set<number>> {
    const userMysekaiCanvas =
        await this.dataProvider.getUserData<UserMysekaiCanvas[] | undefined>('userMysekaiCanvases')
    if (userMysekaiCanvas === undefined) {
      return new Set<number>()
    }
    return new Set(userMysekaiCanvas.map(it => it.cardId)) // 加强检索性能
  }

  /**
   * 获得自定义世界的家具加成
   * 很贴心地已经由服务器算好了，直接返回就行
   * 计算逻辑：totalBonusRate的单位看上去是0.1%
   */
  public async getMysekaiFixtureBonuses (): Promise<UserMysekaiFixtureGameCharacterPerformanceBonus[]> {
    return await this.dataProvider.getUserData<UserMysekaiFixtureGameCharacterPerformanceBonus[]>(
      'userMysekaiFixtureGameCharacterPerformanceBonuses')
  }

  /**
   * 获得自定义世界的大门加成
   * 计算逻辑：原创角色看组合；如果V有支援组合，看支援组合；如果V没有支援组合，取加成最大值
   */
  public async getMysekaiGateBonuses (): Promise<MysekaiGateBonus[]> {
    const userMysekaiGates = await this.dataProvider.getUserData<UserMysekaiGate[] | undefined>('userMysekaiGates')
    if (userMysekaiGates === undefined || userMysekaiGates.length === 0) {
      return []
    }
    const mysekaiGates =
        await this.dataProvider.getMasterData<MysekaiGate>('mysekaiGates')
    const mysekaiGateLevels =
        await this.dataProvider.getMasterData<MysekaiGateLevel>('mysekaiGateLevels')
    return userMysekaiGates
      .map(it => {
        const gate = mysekaiGates.find(g => g.id === it.mysekaiGateId)
        const level = mysekaiGateLevels.find(l =>
          l.mysekaiGateId === it.mysekaiGateId && l.level === it.mysekaiGateLevel)
        // 新增大门（例如 shuffle 门）在上游 Master Data 里可能还没有等级数据，
        // 或者 Master Data 版本落后于用户数据
        // 此时跳过该大门，避免查表失败导致整个组卡计算抛错
        if (gate === undefined || level === undefined) {
          return undefined
        }
        return {
          unit: gate.unit,
          powerBonusRate: level.powerBonusRate
        }
      })
      .filter((it): it is MysekaiGateBonus => it !== undefined)
  }
}

export interface MysekaiGateBonus {
  unit: string
  powerBonusRate: number
}
