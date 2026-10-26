#!/usr/bin/env node
/**
 * 生成 sekai-calculator 单元测试用的 mock 用户数据。
 *
 * 用法（在项目根目录或任意目录都可以）：
 *   node script/gen-mock-user-data.js [每角色卡数=5] [区域道具等级=13]
 *
 * 前置条件：
 *   1. 项目根目录存在 sekai-master-db-diff/（可以直接软链到同级仓库）
 *   2. 项目根目录存在 music_metas.json（https://storage.sekai.best/sekai-best-assets/music_metas.json）
 *   3. 项目已安装 jest / ts-jest（npm i --no-save jest ts-jest typescript @types/jest @types/node）
 *
 * 输出的 mock-user-data.json 会被 .gitignore 忽略，不会进仓库。
 */
const fs = require('fs')
const path = require('path')

const PROJECT = process.env.SEKAI_PROJECT || path.join(__dirname, '..')
const DB = process.env.SEKAI_MASTER_DIR || path.join(PROJECT, 'sekai-master-db-diff')
const OUT = path.join(PROJECT, 'mock-user-data.json')

const PER_CHARACTER = Number(process.argv[2] || 5)
const AREA_LEVEL = Number(process.argv[3] || 13)

// 测试代码里直接引用的卡牌，必须保证在卡池里
const REQUIRED_CARD_IDS = [510, 87, 196, 152, 219, 151, 238, 271, 406]

const load = key => JSON.parse(fs.readFileSync(path.join(DB, key + '.json'), 'utf8'))

function main () {
  const cards = load('cards')
  const rarities = load('cardRarities')
  const cardEpisodes = load('cardEpisodes')
  const areas = load('areas')
  const areaItems = load('areaItems')
  const characterRanks = load('characterRanks')

  const rarityMap = new Map(rarities.map(it => [it.cardRarityType, it]))
  const episodeMap = new Map()
  for (const episode of cardEpisodes) {
    if (!episodeMap.has(episode.cardId)) episodeMap.set(episode.cardId, [])
    episodeMap.get(episode.cardId).push(episode)
  }
  const maxCharacterRank = new Map()
  for (const rank of characterRanks) {
    const current = maxCharacterRank.get(rank.characterId)
    if (current === undefined || rank.characterRank > current) {
      maxCharacterRank.set(rank.characterId, rank.characterRank)
    }
  }

  // 卡池：每个角色取几种属性各一张（优先 4★），再补上测试引用的卡
  // 卡池太大时 World Link（bloom）用例会几乎穷举，跑不完
  const byCharacter = new Map()
  for (const card of cards) {
    if (!byCharacter.has(card.characterId)) byCharacter.set(card.characterId, [])
    byCharacter.get(card.characterId).push(card)
  }
  const chosen = new Set(REQUIRED_CARD_IDS)
  for (const [, list] of byCharacter) {
    const sorted = [...list].sort((a, b) =>
      (a.cardRarityType === 'rarity_4' ? 0 : 1) - (b.cardRarityType === 'rarity_4' ? 0 : 1) || a.id - b.id)
    const attrs = new Set()
    for (const card of sorted) {
      if (attrs.has(card.attr)) continue
      attrs.add(card.attr)
      chosen.add(card.id)
      if (attrs.size >= PER_CHARACTER) break
    }
  }
  const pool = [...chosen].map(id => cards.find(it => it.id === id)).filter(it => it !== undefined)

  const userCards = pool.map(card => {
    const rarity = rarityMap.get(card.cardRarityType)
    return {
      userId: 1145141919810,
      cardId: card.id,
      level: rarity.trainingMaxLevel ?? rarity.maxLevel,
      exp: 0,
      totalExp: 0,
      skillLevel: rarity.maxSkillLevel,
      skillExp: 0,
      totalSkillExp: 0,
      masterRank: 5,
      specialTrainingStatus: 'done',
      defaultImage: 'original',
      duplicateCount: 0,
      createdAt: 0,
      episodes: (episodeMap.get(card.id) ?? []).map(episode => ({
        cardEpisodeId: episode.id,
        scenarioStatus: 'already_read',
        scenarioStatusReasons: [],
        isNotSkipped: true
      }))
    }
  })

  const userAreas = areas.map(area => ({
    areaId: area.id,
    actionSets: [],
    areaItems: areaItems
      .filter(item => item.areaId === area.id)
      .map(item => ({ areaItemId: item.id, level: AREA_LEVEL })),
    userAreaStatus: { areaId: area.id, status: 'already_read' }
  }))

  const data = {
    userCards,
    userAreas,
    userCharacters: [...maxCharacterRank.entries()]
      .map(([characterId, characterRank]) => ({ characterId, characterRank })),
    userHonors: [],
    userMysekaiCanvases: [],
    userMysekaiFixtureGameCharacterPerformanceBonuses: [],
    userMysekaiGates: [],
    // deck-calculator / event-calculator / live-calculator 用的卡组
    userDecks: [{
      userId: 1145141919810,
      deckId: 1,
      name: 'ユニット01',
      leader: 510,
      subLeader: 87,
      member1: 510,
      member2: 87,
      member3: 196,
      member4: 152,
      member5: 219
    }],
    // challenge / area-item / music 用例用的单人卡组
    userChallengeLiveSoloDecks: [{
      characterId: 24,
      leader: 510,
      support1: 151,
      support2: 238,
      support3: 271,
      support4: 406
    }]
  }

  fs.writeFileSync(OUT, JSON.stringify(data))
  console.log(`cards=${pool.length} areaLevel=${AREA_LEVEL} -> ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`)
}

main()
