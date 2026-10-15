import prisma from '../lib/prisma'
import { PERMISSIONS, Permission, hasPermission } from '../lib/permissions'
import { checkMatchEnd } from '../fsm/match.fsm'
import { rotationStateFromRow, courtView } from './rotation.service'
import { requirePermission } from './team-access'
import { calculateLiveStats } from './event.service'

export const assertMatchViewer = async (matchId: string, userId: string): Promise<string> => {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { teamId: true } })
  if (!match) throw new Error('MATCH_NOT_FOUND')
  return requirePermission(match.teamId, userId, 'team.view')
}

export const getLiveSnapshot = async (matchId: string, userId: string) => {
  const role = await assertMatchViewer(matchId, userId)

  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      team: { include: { players: true } },
      lineup: { include: { slots: true } },
      sets: { orderBy: { setNumber: 'asc' } },
      opponentPlayers: { orderBy: { jersey: 'asc' } }
    }
  })

  const active = match.sets.find(s => s.status === 'active') ?? null
  const detail = active
    ? await prisma.matchSet.findUniqueOrThrow({
        where: { id: active.id },
        include: {
          rotations: { orderBy: { recordedAt: 'desc' }, take: 1 },
          events: { include: { player: true, opponentPlayer: true }, orderBy: { occurredAt: 'asc' } },
          substitutions: { orderBy: { subbedAt: 'asc' } },
          timeouts: { orderBy: { calledAt: 'asc' } },
          challenges: { orderBy: { challengedAt: 'asc' } }
        }
      })
    : null

  const finished = match.sets.filter(s => s.status === 'finished')
  const ourSetsWon = finished.filter(s => s.ourScore > s.opponentScore).length
  const opponentSetsWon = finished.filter(s => s.opponentScore > s.ourScore).length
  const state = detail && detail.rotations[0] ? rotationStateFromRow(detail.rotations[0], detail) : null

  return {
    match: {
      id: match.id,
      teamId: match.teamId,
      teamName: match.team.name,
      status: match.status,
      opponentName: match.opponentName,
      competition: match.competition,
      scheduledAt: match.scheduledAt
    },
    role,
    permissions: (Object.keys(PERMISSIONS) as Permission[]).filter(p => hasPermission(role, p)),
    ourSetsWon,
    opponentSetsWon,
    matchOver: checkMatchEnd(ourSetsWon, opponentSetsWon),
    sets: match.sets.map(s => ({
      id: s.id,
      setNumber: s.setNumber,
      ourScore: s.ourScore,
      opponentScore: s.opponentScore,
      status: s.status
    })),
    activeSet: detail
      ? {
          id: detail.id,
          setNumber: detail.setNumber,
          ourScore: detail.ourScore,
          opponentScore: detail.opponentScore,
          servingTeam: detail.servingTeam,
          currentRotation: detail.currentRotation,
          subCount: detail.subCount,
          ourTimeoutsRemaining: detail.ourTimeoutsRemaining,
          oppTimeoutsRemaining: detail.oppTimeoutsRemaining,
          ourChallengesRemaining: detail.ourChallengesRemaining,
          oppChallengesRemaining: detail.oppChallengesRemaining,
          status: detail.status,
          version: detail.version
        }
      : null,
    court: state
      ? { currentPositions: courtView(state), rotationOrder: state.positions, libero: state.libero?.onCourt ?? null }
      : null,
    lineup: {
      id: match.lineup.id,
      name: match.lineup.name,
      rotationSystem: match.lineup.rotationSystem,
      slots: match.lineup.slots.map(s => ({ playerId: s.playerId, role: s.role, rotationPosition: s.rotationPosition }))
    },
    players: match.team.players.map(p => ({
      id: p.id, name: p.name, number: p.number, position: p.position, isLibero: p.isLibero
    })),
    opponentPlayers: match.opponentPlayers.map(p => ({ id: p.id, jersey: p.jersey, name: p.name, position: p.position })),
    events: detail?.events ?? [],
    substitutions: detail?.substitutions ?? [],
    timeouts: detail?.timeouts ?? [],
    challenges: detail?.challenges ?? [],
    liveStats: match.sets.length > 0 ? await calculateLiveStats(active?.id ?? match.sets[0].id, matchId) : null
  }
}

export type LiveSnapshot = Awaited<ReturnType<typeof getLiveSnapshot>>
