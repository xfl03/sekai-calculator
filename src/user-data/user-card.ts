export default interface UserCard {
  cardId: number
  level?: number
  skillLevel?: number
  masterRank: number
  specialTrainingStatus?: string
  episodes?: Array<{ cardEpisodeId: number, scenarioStatus: string }>
}
