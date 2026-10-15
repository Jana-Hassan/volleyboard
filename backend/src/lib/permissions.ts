export type MemberRole = 'manager' | 'coach' | 'assistant' | 'analyst' | 'trainer'

export type Permission =
  | 'team.view'
  | 'team.manage'
  | 'staff.manage'
  | 'roster.edit'
  | 'lineup.edit'
  | 'match.schedule'
  | 'match.run'
  | 'match.resources'
  | 'match.code'
  | 'match.scout'

export const PERMISSIONS: Record<Permission, readonly MemberRole[]> = {
  'team.view':       ['manager', 'coach', 'assistant', 'analyst', 'trainer'],
  'team.manage':     ['manager'],
  'staff.manage':    ['manager'],
  'roster.edit':     ['manager', 'coach', 'assistant'],
  'lineup.edit':     ['manager', 'coach'],
  'match.schedule':  ['manager', 'assistant'],
  'match.run':       ['manager', 'coach'],
  'match.resources': ['manager', 'coach'],
  'match.code':      ['manager', 'coach', 'analyst'],
  'match.scout':     ['manager', 'coach', 'assistant', 'analyst']
}

export const hasPermission = (role: string, permission: Permission): boolean =>
  (PERMISSIONS[permission] as readonly string[]).includes(role)
