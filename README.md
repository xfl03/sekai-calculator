# sekai-calculator
Project SEKAI Calculator for deck power, live score, event point and more.
Moreover, it can recommend deck and music to get higher score or event point.

This project is fully developed with TypeScript, while reducing `any` as possible. 

Both ECMAScript Module `index.mjs` and CommonJS `index.cjs` are provided with types `index.d.ts` for TypeScript.

## Quick Start
### Install
This package has been released in [npm](https://www.npmjs.com/package/sekai-calculator).
```shell
# npm
npm i sekai-calculator
# yarn
yarn add sekai-calculator
# pnpm
pnpm add sekai-calculator
```
### Usage
Example is written in TypeScript.

A `DataProvider` implementation is required for providing `UserData`, `MasterData` and `MusicMeta`.
Basically, `UserArea`, `UserCard`, `UserCharacter` and `UserHonor` are required in `UserData`.

- `MasterData` is the [Sekai master DB](https://github.com/Sekai-World/sekai-master-db-diff) JSON, keyed by table name.
- `MusicMeta` comes from [music_metas.json](https://storage.sekai.best/sekai-best-assets/music_metas.json).

Here is the smallest program that recommends one deck:

```typescript
import { readFileSync } from 'node:fs'
import {
  CachedDataProvider,
  type DataProvider,
  EventDeckRecommend,
  type MusicMeta,
  LiveCalculator,
  LiveType
} from 'sekai-calculator'

// The only thing you must supply: master data, your own user data, and the song meta.
const readJson = (path: string): any => JSON.parse(readFileSync(path, 'utf-8'))

const dataProvider: DataProvider = {
  getMasterData: async <T>(key: string): Promise<T[]> => readJson(`sekai-master-db-diff/${key}.json`),
  getUserData: async <T>(key: string): Promise<T> => (readJson('user-data.json') as Record<string, T>)[key],
  getUserDataAll: async (): Promise<Record<string, any>> => readJson('user-data.json'),
  getMusicMeta: async (): Promise<MusicMeta[]> => readJson('music_metas.json')
}

// Recommended: deck search reads the same master tables over and over,
// this wrapper makes each of them load only once.
const cached = new CachedDataProvider(dataProvider)

const liveCalculator = new LiveCalculator(cached)
const eventDeckRecommend = new EventDeckRecommend(cached)

// Recommend the best deck for event 89, playing song 74 on Master in a multi live.
const musicMeta = await liveCalculator.getMusicMeta(74, 'master')
const decks = await eventDeckRecommend.recommendEventDeck(89, LiveType.MULTI, { musicMeta, limit: 1 })

const best = decks[0]
console.log(`card ids: ${best.cards.map(it => it.cardId).join(', ')}`)
console.log(`event bonus: ${best.eventBonus ?? 0}%`)
console.log(`event point: ${best.score}`)
```

`recommendEventDeck` returns decks sorted by the given score (event point here). Besides `musicMeta`,
[`DeckRecommendConfig`](src/deck-recommend/base-deck-recommend.ts) also accepts `member`, `leaderCharacter`,
`cardConfig` and `debugLog`.

Other entry points follow the same shape: `ChallengeLiveDeckRecommend` for Challenge Live,
`BloomSupportDeckRecommend` for World Link support decks, and `MusicRecommend` for picking a song.
