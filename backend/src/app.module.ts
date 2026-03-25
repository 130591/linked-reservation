import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmPersistenceModule } from '@/common/database/persistence/typeorm-persistence.module'
import { dataSourceOptionsFactory } from '@/common/database/persistence/typeorm-datasource.factory'
import { NotificationModule } from './notification/notification.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [],
    }),
    ...(process.env.NODE_ENV !== 'test'
      ? [
        TypeOrmPersistenceModule.forRoot({
          inject: [ConfigService],
          useFactory: dataSourceOptionsFactory,
        }),
        NotificationModule
      ]
      : []),
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
