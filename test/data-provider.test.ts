import { type DataProvider } from '../src'
import { readFileSync } from 'fs'

const USE_LOCAL_JSON = true

// 用于测试的用户数据
const mockUserData = JSON.parse(readFileSync('mock-user-data.json', 'utf8'))
const cache = new Map<string, any>()

async function getRemoteJson (url: string): Promise<any> {
  if (cache.has(url)) return cache.get(url)
  const res = await fetch(url)
  const json = await res.json()
  cache.set(url, json)
  return json
}

async function getLocalJson (path: string): Promise<any> {
  if (cache.has(path)) return cache.get(path)
  const json = JSON.parse(readFileSync(path, 'utf8'))
  cache.set(path, json)
  return json
}

/**
 * 用于测试的数据源
 */
export class TestDataProvider implements DataProvider {
  public static INSTANCE = new TestDataProvider()
  async getMasterData (key: string): Promise<any> {
    return USE_LOCAL_JSON
      ? await getLocalJson(`sekai-master-db-diff/${key}.json`)
      : await getRemoteJson(`https://sekai-world.github.io/sekai-master-db-diff/${key}.json`)
  }

  async getUserData (key: string): Promise<any> {
    return mockUserData[key]
  }

  async getMusicMeta (): Promise<any> {
    return USE_LOCAL_JSON
      ? await getLocalJson('music_metas.json')
      : await getRemoteJson('https://storage.sekai.best/sekai-best-assets/music_metas.json')
  }
}

test('master data', async () => {
  await TestDataProvider.INSTANCE.getMasterData('gameCharacterUnits').then(it => {
    expect(it).not.toBeUndefined()
    expect(it.length).toBe(56)
  })
})
