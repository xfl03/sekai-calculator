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
```typescript
// W.I.P.
```

## Development

### Release
```shell
pnpm release
```
