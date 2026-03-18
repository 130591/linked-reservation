import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { initializeTransactionalContext } from 'typeorm-transactional'

import { AppModule } from '@/app.module'
import { AllExceptionsFilter, ResultInterceptor } from '@/common/framework'

async function bootstrap() {
  initializeTransactionalContext()
  const app = await NestFactory.create(AppModule)

  const httpAdapterHost = app.get(HttpAdapterHost)
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost))
  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  app.useGlobalInterceptors(new ResultInterceptor())

  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()
