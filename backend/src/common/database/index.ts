import { QueryFailedError } from 'typeorm'

export * from './persistence'
export * from './entities'
export * from './repositories'

export function isExclusionConstraintError(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false
  return (err as any).code === '23P01'
}