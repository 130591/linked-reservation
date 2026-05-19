import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ReservationTokenGuard } from '@/common/framework/guards/reservation-token.guard'
import { ResolvePaymentStatus } from '@/payment/core/service'

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly resolvePaymentStatus: ResolvePaymentStatus,
  ) {}

  @UseGuards(ReservationTokenGuard)
  @Get('status')
  async getPaymentStatus(@Query('intentId') intentId: string) {
    return this.resolvePaymentStatus.handle(intentId)
  }
}
