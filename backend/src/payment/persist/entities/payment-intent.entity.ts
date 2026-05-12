import { Column, Entity } from 'typeorm'
import { DefaultEntity } from '@/common/database/entities'
import { PaymentIntentStatus } from '@/payment/core/domain'

@Entity({ name: 'payment_intents', schema: 'payment' })
export class PaymentIntentEntity extends DefaultEntity<PaymentIntentEntity> {
  @Column({ name: 'reservation_id', type: 'uuid' })
  reservationId: string

  @Column({ name: 'provider_intent_id', type: 'varchar', unique: true })
  providerIntentId: string

  @Column({ name: 'amount_cents', type: 'bigint' })
  amountCents: number

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string

  @Column({ type: 'varchar', default: PaymentIntentStatus.pending })
  status: PaymentIntentStatus

  @Column({ name: 'last_event_payload', type: 'jsonb', nullable: true })
  lastEventPayload: object | null

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null
}
