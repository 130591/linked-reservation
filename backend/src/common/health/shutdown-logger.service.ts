import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common'

@Injectable()
export class ShutdownLoggerService implements BeforeApplicationShutdown, OnApplicationShutdown {
  private readonly logger = new Logger('Shutdown')
  private start: number | null = null

  beforeApplicationShutdown(signal?: string) {
    this.start = Date.now()
    this.logger.log({ event: 'shutdown.start', signal })
  }

  onApplicationShutdown(signal?: string) {
    const duration = this.start ? Date.now() - this.start : 0
    this.logger.log({ event: 'shutdown.complete', signal, shutdown_duration_ms: duration })
  }
}
