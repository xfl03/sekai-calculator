import { type DataProvider } from '../data-provider/data-provider'
import { CardCalculator, type CardDetail } from '../card-information/card-calculator'
import { type UserCard } from '../user-data/user-card'
import { EventCalculator } from '../event-point/event-calculator'

export class BloomSupportDeckRecommend {
  private readonly cardCalculator: CardCalculator
  public constructor (private readonly dataProvider: DataProvider) {
    this.cardCalculator = new CardCalculator(dataProvider)
  }

  /**
   * 推荐支援卡组
   * @param mainDeck 主要卡组
   * @param specialCharacterId 支援角色
   */
  public async recommendBloomSupportDeck (
    mainDeck: Array<{ cardId: number }>, specialCharacterId: number
  ): Promise<CardDetail[]> {
    const userCards = await this.dataProvider.getUserData<UserCard[]>('userCards')
    const allCards =
      await this.cardCalculator.batchGetCardDetail(userCards, {}, { specialCharacterId })
    return EventCalculator.getSupportDeckBonus(mainDeck, allCards).cards
  }
}
