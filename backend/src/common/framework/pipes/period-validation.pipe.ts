import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import { LeaderboardPeriod } from '../../../leaderboards/app/domain/types'

const VALID_PERIODS: LeaderboardPeriod[] = ['weekly', 'monthly']

@Injectable()
export class PeriodValidationPipe implements PipeTransform {
  transform(value: string): LeaderboardPeriod {
    if (!VALID_PERIODS.includes(value as LeaderboardPeriod)) {
      throw new BadRequestException({
        error: {
          code: 'invalid_request',
          message: `Invalid period: ${value}. Must be one of: ${VALID_PERIODS.join(', ')}`,
          details: null,
        },
      })
    }
    return value as LeaderboardPeriod
  }
}