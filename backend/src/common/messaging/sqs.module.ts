import { Module, Global } from '@nestjs/common'
import { ConfigService } from '@/common/config'
import { SQSClient } from '@aws-sdk/client-sqs'

@Global()
@Module({
  providers: [
    {
      provide: 'SQS_CLIENT',
      useFactory: (config: ConfigService) => {
        return new SQSClient({
          region: config.get('awsRegion'),
          endpoint: config.get('sqsBaseUrl'),
          credentials: {
            accessKeyId: config.get('accessKeyId'),
            secretAccessKey: config.get('secretAccessKey')
          }
        })
      },
      inject: [ConfigService]
    }
  ],
  exports: ['SQS_CLIENT']
})
export class SqsClientModule {}
