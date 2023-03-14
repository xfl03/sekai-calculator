import { type DataProvider } from '../src'
import { readFileSync } from 'fs'

// 用于测试的用户数据
const mockUserData = JSON.parse(readFileSync('mock-user-data.json', 'utf8'))
const cache = new Map<string, any>()

async function getJson (url: string): Promise<any> {
  if (cache.has(url)) return cache.get(url)
  const res = await fetch(url)
  const json = await res.json()
  cache.set(url, json)
  return json
}

/**
 * 用于测试的数据源
 */
export class TestDataProvider implements DataProvider {
  public static INSTANCE = new TestDataProvider()
  async getMasterData (key: string): Promise<any> {
    return await getJson(`https://sekai-world.github.io/sekai-master-db-diff/${key}.json`)
  }

  async getUserData (key: string): Promise<any> {
    return mockUserData[key]
  }

  async getMusicMeta (): Promise<any> {
    await getJson('https://storage.sekai.best/sekai-best-assets/music_metas.json')
  }
}

test('master data', async () => {
  await TestDataProvider.INSTANCE.getMasterData('gameCharacterUnits').then(it => {
    expect(it).not.toBeUndefined()
    expect(it.length).not.toBe(0)
  })
})
