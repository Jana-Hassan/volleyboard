import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AppError'
    this.status = status
  }
}

const ERROR_MAP: Record<string, { status: number; message?: string }> = {
  FORBIDDEN:                   { status: 403, message: 'Forbidden' },
  MATCH_NOT_FOUND:             { status: 404, message: 'Match not found' },
  SET_NOT_FOUND:               { status: 404, message: 'Set not found' },
  LINEUP_NOT_FOUND:            { status: 404, message: 'Lineup not found' },
  TEAM_NOT_FOUND:              { status: 404, message: 'Team not found' },
  PLAYER_NOT_FOUND:            { status: 404, message: 'Player not found' },
  USER_NOT_FOUND:              { status: 404, message: 'User not found' },
  EMAIL_TAKEN:                 { status: 409, message: 'Email already registered' },
  INVALID_CREDENTIALS:         { status: 401, message: 'Invalid email or password' },
  NUMBER_TAKEN:                { status: 409, message: 'Jersey number already taken' },
  ALREADY_MEMBER:              { status: 409, message: 'User is already a team member' },
  INVALID_ROLE:                { status: 400, message: 'Invalid role' },
  INVALID_PLAYERS:             { status: 400, message: 'One or more players do not belong to this team' },
  INVALID_STARTER_COUNT:       { status: 400, message: 'Lineup must have exactly 6 starters' },
  DUPLICATE_ROTATION_POSITION: { status: 400, message: 'Two starters cannot have the same rotation position' },
  TOO_MANY_LIBEROS:            { status: 400, message: 'Only one libero can be in the starting lineup' },
  SET_FINISHED:                { status: 409, message: 'This set is already finished' },
  PREVIOUS_SET_NOT_FINISHED:   { status: 409, message: 'Previous set is not finished yet' },
  MATCH_ALREADY_OVER:          { status: 409, message: 'Match is already over' },
  LIBERO_FRONT_ROW:            { status: 400, message: 'Libero can only swap with back row players' },
  INVALID_EVENT_TYPE:        { status: 400, message: 'Invalid event type. Must be attack, serve, reception, block, dig or set' },
  INVALID_OUTCOME:           { status: 400, message: 'Invalid outcome for this event type' },
  OPPONENT_PLAYER_NOT_FOUND: { status: 404, message: 'Opponent player not found' },
  INVALID_ROTATION_POSITION:  { status: 400, message: 'Rotation position must be between 1 and 6' },
INVALID_SETTER_COUNT_5_1:   { status: 400, message: '5-1 system requires exactly 1 setter in the starting six' },
INVALID_SETTER_COUNT_6_2:   { status: 400, message: 'This system requires exactly 2 setters in the starting six' },
LINEUP_IN_USE:              { status: 409, message: 'Cannot delete a lineup that is used by a match' },


}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.name === 'AppError') {
    const appError = error as AppError
    res.status(appError.status).json({ error: appError.message })
    return
  }

  if (error.name === 'InvalidTransitionError' || error.name === 'GuardError') {
    res.status(422).json({ error: error.message })
    return
  }

  const mapped = ERROR_MAP[error.message]
  if (mapped) {
    res.status(mapped.status).json({ error: mapped.message ?? error.message })
    return
  }

  console.error('Unhandled error:', error)
  res.status(500).json({ error: 'Internal server error' })
}