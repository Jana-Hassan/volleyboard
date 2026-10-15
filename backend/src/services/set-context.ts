import { Prisma } from '@prisma/client'
import { Permission } from '../lib/permissions'
import { rotationStateFromRow, RotationState } from './rotation.service'
import { requirePermission } from './team-access'
import { lockSet } from './row-lock'

const setInclude = {
  match: {
    include: { lineup: { include: { slots: { include: { player: true } } } } }
  },
  rotations: { orderBy: { recordedAt: 'desc' as const }, take: 1 },
  substitutions: { orderBy: { subbedAt: 'asc' as const } },
  challenges: { orderBy: { challengedAt: 'asc' as const } }
}

export type LoadedSet = Prisma.MatchSetGetPayload<{ include: typeof setInclude }>

export interface ActiveSet {
  set: LoadedSet
  state: RotationState
  rally: number
  pendingChallenge: LoadedSet['challenges'][number] | null
}

export const loadActiveSetWithin = async (
  tx: Prisma.TransactionClient,
  setId: string,
  userId: string,
  permission: Permission
): Promise<ActiveSet> => {
  await lockSet(tx, setId)

  const set = await tx.matchSet.findUnique({ where: { id: setId }, include: setInclude })
  if (!set) throw new Error('SET_NOT_FOUND')
  if (set.status === 'finished') throw new Error('SET_FINISHED')
  await requirePermission(set.match.teamId, userId, permission, tx)

  return {
    set,
    state: rotationStateFromRow(set.rotations[0], set),
    rally: set.ourScore + set.opponentScore,
    pendingChallenge: set.challenges.find(c => c.successful === null) ?? null
  }
}

export const assertNoPendingChallenge = (pending: unknown): void => {
  if (pending) throw new Error('CHALLENGE_PENDING')
}
