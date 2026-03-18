import { NestFactory } from '@nestjs/core'
import { DataSource, DataSourceOptions } from 'typeorm'
import { ConfigModule, ConfigService } from '@/common/config'
import { dataSourceOptionsFactory } from '@/common/database'


const getDataSource = async () => {
  const configModule = await NestFactory.createApplicationContext(
    ConfigModule.forRoot({
      load: [],
    })
  )
  const configService = configModule.get<ConfigService>(ConfigService)

  return new DataSource(dataSourceOptionsFactory(configService) as DataSourceOptions)
}

export default getDataSource()