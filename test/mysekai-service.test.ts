import type { DataProvider, MusicMeta } from '../src'
import { MysekaiService } from '../src/mysekai-information/mysekai-service'
import { TestDataProvider } from './data-provider.test'

function createService (
  gates: Record<string, any>[],
  levels: Record<string, any>[],
  userGates: Record<string, any>[]
): MysekaiService {
  const tables: Record<string, Record<string, any>[]> = {
    mysekaiGates: gates,
    mysekaiGateLevels: levels
  }
  const userData: Record<string, any> = { userMysekaiGates: userGates }
  const dataProvider: DataProvider = {
    async getMasterData<T> (key: string): Promise<T[]> {
      return (tables[key] ?? []) as T[]
    },
    async getUserData<T> (key: string): Promise<T> {
      return userData[key] as T
    },
    async getUserDataAll (): Promise<Record<string, any>> {
      return userData
    },
    async getMusicMeta (): Promise<MusicMeta[]> {
      return []
    }
  }
  return new MysekaiService(dataProvider)
}

const GATES = [
  { id: 1, unit: 'light_sound', mysekaiGateType: 'unit', name: 'a', assetbundleName: 'a' },
  { id: 6, unit: 'none', mysekaiGateType: 'shuffle', name: 'b', assetbundleName: 'b' }
]
const LEVELS = [
  { id: 1001, mysekaiGateId: 1, level: 1, mysekaiGateMaterialGroupId: 1001, mysekaiGateCharacterVisitCountRateId: 1, powerBonusRate: 0.1 }
]

test('mysekai gate bonus', async () => {
  const service = createService(GATES, LEVELS, [
    { mysekaiGateId: 1, mysekaiGateSkinId: 1, mysekaiGateLevel: 1, visitCount: 0, isSettingAtHomeSite: false }
  ])
  expect(await service.getMysekaiGateBonuses()).toEqual([{ unit: 'light_sound', powerBonusRate: 0.1 }])
})

test('mysekai gate without level data is skipped', async () => {
  // shuffle 门在上游 Master Data 中没有等级数据
  const service = createService(GATES, LEVELS, [
    { mysekaiGateId: 1, mysekaiGateSkinId: 1, mysekaiGateLevel: 1, visitCount: 0, isSettingAtHomeSite: false },
    { mysekaiGateId: 6, mysekaiGateSkinId: 1, mysekaiGateLevel: 1, visitCount: 0, isSettingAtHomeSite: false }
  ])
  expect(await service.getMysekaiGateBonuses()).toEqual([{ unit: 'light_sound', powerBonusRate: 0.1 }])
})

test('mysekai gate missing in master data is skipped', async () => {
  const service = createService(GATES, LEVELS, [
    { mysekaiGateId: 1, mysekaiGateSkinId: 1, mysekaiGateLevel: 1, visitCount: 0, isSettingAtHomeSite: false },
    { mysekaiGateId: 99, mysekaiGateSkinId: 1, mysekaiGateLevel: 1, visitCount: 0, isSettingAtHomeSite: false }
  ])
  expect(await service.getMysekaiGateBonuses()).toEqual([{ unit: 'light_sound', powerBonusRate: 0.1 }])
})

test('mysekai gate with real master data', async () => {
  const dataProvider: DataProvider = {
    async getMasterData<T> (key: string): Promise<T[]> {
      return await TestDataProvider.INSTANCE.getMasterData<T>(key)
    },
    async getUserData<T> (key: string): Promise<T> {
      return (key === 'userMysekaiGates'
        ? [
            { mysekaiGateId: 1, mysekaiGateSkinId: 1, mysekaiGateLevel: 70, visitCount: 0, isSettingAtHomeSite: false },
            { mysekaiGateId: 6, mysekaiGateSkinId: 1, mysekaiGateLevel: 1, visitCount: 0, isSettingAtHomeSite: false }
          ]
        : undefined) as T
    },
    async getUserDataAll (): Promise<Record<string, any>> {
      return {}
    },
    async getMusicMeta (): Promise<MusicMeta[]> {
      return []
    }
  }
  const service = new MysekaiService(dataProvider)
  expect(await service.getMysekaiGateBonuses()).toEqual([{ unit: 'light_sound', powerBonusRate: 7 }])
})
