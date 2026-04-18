import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { Logger, ValidationPipe } from '@nestjs/common'
import { initializeTransactionalContext } from 'typeorm-transactional'

import { AppModule } from '@/app.module'
import { AllExceptionsFilter, ResultInterceptor } from '@/common/framework'

// Must be < ALB deregistration_delay (30s) to finish in-flight work before
// the target is considered drained. See ADR 0004.
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 25_000

async function bootstrap() {
  initializeTransactionalContext()
  const app = await NestFactory.create(AppModule)

  const httpAdapterHost = app.get(HttpAdapterHost)
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost))
  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  app.useGlobalInterceptors(new ResultInterceptor())

  app.enableShutdownHooks()
  armShutdownKillSwitch()

  await app.listen(process.env.PORT ?? 3000)
}

function armShutdownKillSwitch() {
  const logger = new Logger('Shutdown')
  const handler = (signal: NodeJS.Signals) => {
    setTimeout(() => {
      logger.error({
        event: 'shutdown.forced',
        signal,
        shutdown_duration_ms: GRACEFUL_SHUTDOWN_TIMEOUT_MS,
      })
      process.exit(1)
    }, GRACEFUL_SHUTDOWN_TIMEOUT_MS).unref()
  }
  process.on('SIGTERM', handler)
  process.on('SIGINT', handler)
}

bootstrap()
