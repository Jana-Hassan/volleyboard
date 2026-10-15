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
  TOO_MANY_LIBEROS:            { status: 400, message: 'A lineup can have at most two liberos' },
  SET_FINISHED:                { status: 409, message: 'This set is already finished' },
  PREVIOUS_SET_NOT_FINISHED:   { status: 409, message: 'Previous set is not finished yet' },
  MATCH_ALREADY_OVER:          { status: 409, message: 'Match is already over' },
  LIBERO_FRONT_ROW:            { status: 400, message: 'Libero can only swap with back row players' },
  INVALID_EVENT_TYPE:        { status: 400, message: 'Invalid event type. Must be attack, serve, reception, block, dig or set' },
  INVALID_OUTCOME:           { status: 400, message: 'Invalid outcome for this event type' },
  OPPONENT_PLAYER_NOT_FOUND: { status: 404, message: 'Opponent player not found' },
  INVALID_ROTATION_POSITION:  { status: 400, message: 'Rotation position must be between 1 and 6' },
  INVALID_SETTER_COUNT_5_1:  { status: 400, message: '5-1 system requires exactly 1 setter in the starting six' },
  INVALID_SETTER_COUNT_6_2:  { status: 400, message: 'This system requires exactly 2 setters in the starting six' },
  LINEUP_IN_USE:             { status: 409, message: 'Cannot delete a lineup that is used by a match' },
  MEMBER_NOT_FOUND:          { status: 404, message: 'Team member not found' },
  LAST_MANAGER:              { status: 409, message: 'A team must keep at least one manager' },
  LIBERO_AS_STARTER:         { status: 400, message: 'A libero cannot be one of the six starters. Edit the lineup and put the libero in a libero slot' },
  NOT_A_LIBERO:              { status: 400, message: 'Only a player registered as libero can take a libero slot' },
  LIBERO_ON_BENCH:           { status: 400, message: 'A registered libero cannot be a bench substitute' },
  LIBERO_NOT_IN_LINEUP:      { status: 400, message: 'That player is not a libero in this lineup' },
  LIBERO_ALREADY_ON_COURT:   { status: 409, message: 'A libero is already on court' },
  NO_LIBERO_ON_COURT:        { status: 409, message: 'No libero is on court' },
  LIBERO_NEEDS_RALLY:        { status: 409, message: 'There must be a completed rally between two libero replacements' },
  LIBERO_CANNOT_SERVE:       { status: 400, message: 'The libero cannot replace the server' },
  PLAYER_NOT_ON_COURT:       { status: 400, message: 'That player is not on court' },
  SUB_EMPTY:                 { status: 400, message: 'A substitution request needs at least one player' },
  SUB_LIMIT:                 { status: 409, message: 'No more than 6 substitutions per set' },
  SUB_NEEDS_RALLY:           { status: 409, message: 'There must be a completed rally between two substitution requests' },
  SUB_PLAYER_ALREADY_LEFT:   { status: 409, message: 'A starter may leave the court only once per set' },
  SUB_PLAYER_ALREADY_PLAYED: { status: 409, message: 'A substitute may enter only once per set' },
  SUB_WRONG_PAIR:            { status: 409, message: 'A substitute can only be replaced by the starter they replaced' },
  PLAYER_NOT_ON_BENCH:       { status: 400, message: 'That player is not on the bench for this match' },
  PLAYER_ALREADY_ON_COURT:   { status: 400, message: 'That player is already on court' },
  LIBERO_NOT_SUBSTITUTABLE:  { status: 400, message: 'The libero is changed with libero replacements, not substitutions' },
  LIBERO_REPLACING_PLAYER:   { status: 409, message: 'That player is off court for the libero. Take the libero off first' },
  NO_TIMEOUTS_LEFT:          { status: 409, message: 'No time-outs left in this set' },
  NO_CHALLENGES_LEFT:        { status: 409, message: 'No challenges left in this set' },
  CHALLENGE_PENDING:         { status: 409, message: 'A video challenge is under review' },
  NOTHING_TO_CHALLENGE:      { status: 409, message: 'No rally has been played yet in this set' },
  RALLY_ALREADY_CHALLENGED:  { status: 409, message: 'This rally has already been challenged by that team' },
  CHALLENGE_NOT_FOUND:       { status: 404, message: 'Challenge not found' },
  CHALLENGE_ALREADY_RESOLVED: { status: 409, message: 'This challenge has already been resolved' },
  NOTHING_TO_OVERTURN:       { status: 409, message: 'The challenging team already won that rally' },
  NOTHING_TO_UNDO:           { status: 409, message: 'Nothing to undo in this set' },
  UNDO_NOT_LATEST:           { status: 409, message: 'Something was recorded after this action, so it can no longer be undone' },
  UNDO_UNSUPPORTED:          { status: 409, message: 'This point was recorded before undo existed and cannot be undone' },
  INVALID_JERSEY:            { status: 400, message: 'Jersey number must be between 1 and 99' },
  OPPONENT_JERSEY_TAKEN:     { status: 409, message: 'That jersey number is already in the opponent roster' },
  OPPONENT_PLAYER_HAS_EVENTS: { status: 409, message: 'This opponent player already has coded events and cannot be removed' },
  INVALID_ZONE:              { status: 400, message: 'Attack zone must be 1 to 6 and only applies to attacks' }
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