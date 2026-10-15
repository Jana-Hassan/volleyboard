import prisma from '../lib/prisma'
import { aggregatePlayers, aggregateTeam, pointProgression, rotationEfficiency, skillLine, attackZones, StatEvent } from '../lib/stats'
import { requirePermission } from './team-access'

export const getMatchReport = async (matchId: string, userId: string) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team: { include: { players: true } },
      opponentPlayers: { orderBy: { jersey: 'asc' } },
      sets: {
        orderBy: { setNumber: 'asc' },
        include: {
          events: { include: { player: true }, orderBy: { occurredAt: 'asc' } },
          substitutions: { orderBy: { subbedAt: 'asc' } },
          timeouts: { orderBy: { calledAt: 'asc' } },
          challenges: { orderBy: { challengedAt: 'asc' } }
        }
      }
    }
  })
  if (!match) throw new Error('MATCH_NOT_FOUND')
  await requirePermission(match.teamId, userId, 'team.view')

  const playerById = new Map(match.team.players.map(p => [p.id, p]))
  const nameOf = (id: string) => playerById.get(id)?.name ?? 'Unknown'
  const numberOf = (id: string) => playerById.get(id)?.number ?? ''

  const toStat = (e: typeof match.sets[number]['events'][number]): StatEvent => ({
    id: e.id, team: e.team, eventType: e.eventType, outcome: e.outcome,
    playerId: e.playerId, playerName: e.player?.name ?? null, rotation: e.rotation, payload: e.payload
  })
  const all = match.sets.flatMap(s => s.events.map(toStat))
  const finished = match.sets.filter(s => s.status === 'finished')

  const log = match.sets.flatMap(s => [
    ...s.substitutions.map(x => ({
      at: x.subbedAt, setNumber: s.setNumber, score: `${x.atScoreUs}–${x.atScoreThem}`, kind: 'substitution' as const,
      text: `#${numberOf(x.playerInId)} ${nameOf(x.playerInId)} on for #${numberOf(x.playerOutId)} ${nameOf(x.playerOutId)}`
    })),
    ...s.timeouts.map(x => ({
      at: x.calledAt, setNumber: s.setNumber, score: `${x.atScoreUs}–${x.atScoreThem}`, kind: 'timeout' as const,
      text: `Time-out ${x.calledBy === 'us' ? match.team.name : match.opponentName}`
    })),
    ...s.challenges.map(x => ({
      at: x.challengedAt, setNumber: s.setNumber, score: `${x.atScoreUs}–${x.atScoreThem}`, kind: 'challenge' as const,
      text: `Challenge ${x.challenger === 'us' ? match.team.name : match.opponentName} · ${x.callType.replace(/_/g, ' ')} · ${x.successful === null ? 'pending' : x.successful ? 'upheld' : 'rejected'}`
    }))
  ]).sort((a, b) => a.at.getTime() - b.at.getTime())

  return {
    match: {
      id: match.id,
      teamId: match.teamId,
      teamName: match.team.name,
      opponentName: match.opponentName,
      competition: match.competition,
      status: match.status,
      date: match.scheduledAt ?? match.startedAt
    },
    ourSetsWon: finished.filter(s => s.ourScore > s.opponentScore).length,
    opponentSetsWon: finished.filter(s => s.opponentScore > s.ourScore).length,
    sets: match.sets.map(s => ({
      setNumber: s.setNumber,
      ourScore: s.ourScore,
      opponentScore: s.opponentScore,
      status: s.status,
      progression: pointProgression(s.events.map(toStat))
    })),
    players: aggregatePlayers(all)
      .map(p => ({ ...p, number: numberOf(p.playerId) }))
      .sort((a, b) => b.totalPoints - a.totalPoints || Number(a.number) - Number(b.number)),
    opponentPlayers: match.opponentPlayers
      .map(op => {
        const theirs = match.sets.flatMap(s => s.events.filter(e => e.opponentPlayerId === op.id).map(toStat))
        return { opponentPlayerId: op.id, jersey: op.jersey, name: op.name, ...skillLine(theirs), actions: theirs.length }
      })
      .filter(op => op.actions > 0),
    teams: { us: aggregateTeam(all, 'us'), opponent: aggregateTeam(all, 'opponent') },
    rotation: rotationEfficiency(all),
    attackZones: attackZones(all),
    log
  }
}
