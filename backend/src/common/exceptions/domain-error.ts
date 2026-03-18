import { HttpException } from '@nestjs/common'

export abstract class DomainError extends Error {
  constructor(
    public readonly message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message)
    this.cause = cause
    Object.setPrototypeOf(this, new.target.prototype)
  }

  abstract toHttpException(): HttpException
}

