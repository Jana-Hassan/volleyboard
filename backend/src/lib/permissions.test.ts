import { describe, it, expect } from 'vitest'
import { hasPermission, PERMISSIONS, Permission, MemberRole } from './permissions'

const ROLES: MemberRole[] = ['manager', 'coach', 'assistant', 'analyst', 'trainer']

// The agreed role matrix, written out by role so a reviewer can read it.
const EXPECTED: Record<MemberRole, Permission[]> = {
  manager:   Object.keys(PERMISSIONS) as Permission[],
  coach:     ['team.view', 'roster.edit', 'lineup.edit', 'match.run', 'match.resources', 'match.code', 'match.scout'],
  assistant: ['team.view', 'roster.edit', 'match.schedule', 'match.scout'],
  analyst:   ['team.view', 'match.code', 'match.scout'],
  trainer:   ['team.view']
}

describe('permissions', () => {
  for (const role of ROLES) {
    it(`${role} has exactly the agreed permissions`, () => {
      const granted = (Object.keys(PERMISSIONS) as Permission[]).filter(p => hasPermission(role, p))
      expect(granted.sort()).toEqual([...EXPECTED[role]].sort())
    })
  }

  it('denies unknown roles everything', () => {
    for (const p of Object.keys(PERMISSIONS) as Permission[]) {
      expect(hasPermission('owner', p)).toBe(false)
    }
  })
})
