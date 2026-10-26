export interface MusicScore {
  notes: MusicNote[]
  skills: MusicNoteBase[]
  /**
   * Fever 区间，Long 歌曲没有 Fever
   */
  fevers?: MusicNoteBase[]
}

export interface MusicNoteBase {
  time: number
}

export interface MusicNote extends MusicNoteBase {
  type: number
  longId?: number
}
