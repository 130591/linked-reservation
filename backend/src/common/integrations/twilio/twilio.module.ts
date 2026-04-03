import { Module, Global } from '@nestjs/common'
import { TwilioService } from './twilio.service'
import { TwilioSignatureGuard } from './twilio-signature.guard'

@Global()
@Module({
  providers: [TwilioService, TwilioSignatureGuard],
  exports: [TwilioService, TwilioSignatureGuard],
})
export class TwilioModule {}
