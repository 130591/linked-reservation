import { ConfigService } from '@/common/config/service/config.service'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'

export const dataSourceOptionsFactory = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('database.host'),
  port: configService.get('database.port'),
  username: configService.get('database.username'),
  password: configService.get('database.password'),
  database: configService.get('database.database'),
  synchronize: false,
  autoLoadEntities: true,
  logging: false,
})
