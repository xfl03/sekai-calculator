import { TestDataProvider } from './data-provider.test'
import { LiveCalculator, LiveType } from '../src'

const dataProvider = TestDataProvider.INSTANCE
const liveCalculator = new LiveCalculator(dataProvider)

// 卡组回复量为250，分数不好说
test('solo', async () => {
  await liveCalculator.getLiveDetailById(
    1, 1, 'easy', LiveType.SOLO).then(it => {
    expect(it.life).toBe(1250)
    expect(it.tap).toBe(76)
    expect(it.time).toBe(123.2)
    expect(it.score).not.toBe(0)
  })
})

// 多人卡组无回复
test('multi', async () => {
  await liveCalculator.getLiveDetailById(
    1, 1, 'easy', LiveType.MULTI).then(it => {
    expect(it.life).toBe(1000)
    expect(it.tap).toBe(76)
    expect(it.time).toBe(123.2)
    expect(it.score).not.toBe(0)
  })
})
