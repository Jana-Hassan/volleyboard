export const VALID_OUTCOMES: Record<string, string[]> = {
  attack:    ['kill', 'error', 'in_play', 'blocked'],
  serve:     ['ace', 'error', 'in_play'],
  reception: ['perfect', 'good', 'error'],
  block:     ['kill', 'error', 'in_play', 'touch'],
  dig:       ['perfect', 'good', 'error'],
  set:       ['perfect', 'good', 'error']
}

export const VALID_ROLES = ['starter', 'bench', 'reserved']
export const VALID_ROTATION_POSITIONS = [1, 2, 3, 4, 5, 6]
export const VALID_MEMBER_ROLES = ['coach', 'assistant', 'analyst', 'trainer']

export const MAX_SUBS_PER_SET = 6
export const MAX_CHALLENGES_PER_SET = 2
export const MAX_TIMEOUTS_PER_SET = 2
export const REGULAR_SET_TARGET = 25
export const DECIDING_SET_TARGET = 15
export const MIN_WIN_DIFF = 2

export const BACK_ROW_POSITIONS = [1, 5, 6]

export const ROTATION_MAP: Record<number, number> = {
  1: 6,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5
}

export const FRONT_BACK_RULES: { front: number; back: number }[] = [
  { front: 2, back: 1 },
  { front: 3, back: 6 },
  { front: 4, back: 5 }
]

export const LEFT_RIGHT_RULES: { left: number; right: number }[] = [
  { left: 4, right: 3 },
  { left: 3, right: 2 },
  { left: 5, right: 6 },
  { left: 6, right: 1 }
]