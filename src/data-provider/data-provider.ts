/**
 * 数据获取接口
 */
export interface DataProvider {
  getMasterData: (key: string) => Promise<any>
  getUserDataAll: () => Promise<any>
  getUserData: (key: string) => Promise<any>
  getMusicMeta: () => Promise<any>
}
