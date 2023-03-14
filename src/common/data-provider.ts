/**
 * 数据获取接口
 */
export default interface DataProvider {
  getMasterData: (key: string) => Promise<any>
  getUserData: (key: string) => Promise<any>
  getMusicMeta: () => Promise<any>
}
