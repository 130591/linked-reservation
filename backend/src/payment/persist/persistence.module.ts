import { DataSource } from 'typeorm'
import { dataSourceOptionsFactory, TypeOrmPersistenceModule } from '@/common/database/persistence'
import { Module } from '@nestjs/common'
import { addTransactionalDataSource } from 'typeorm-transactional'
import { ConfigService } from '@/common/config/service/config.service'
import { PaymentIntentRepository } from './repositories/payment-intent.repository'
import { WebhookEventRepository } from './repositories/webhook-event.repository'

const repositories = [PaymentIntentRepository, WebhookEventRepository]

@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      name: 'payment',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => dataSourceOptionsFactory(configService),
      dataSourceFactory: async (options) => {
        if (!options) throw new Error('Invalid options passed')
        const dataSource = new DataSource(options)
        return addTransactionalDataSource({ name: options.name, dataSource })
      },
    }),
  ],
  providers: [...repositories],
  exports: [...repositories],
})
export class PaymentPersistenceModule {}
