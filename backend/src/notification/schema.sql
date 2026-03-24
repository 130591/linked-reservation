-- Registro de cada notificação enviada (idempotência + auditoria)
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Destinatário
  recipient_id   UUID NOT NULL,      -- staffId ou customerId
  recipient_type VARCHAR NOT NULL,   -- 'STAFF' | 'CUSTOMER'
  channel        VARCHAR NOT NULL,   -- 'WHATSAPP' | 'EMAIL'
  destination    VARCHAR NOT NULL,   -- phone ou email
  
  -- Conteúdo
  event_type     VARCHAR NOT NULL,   -- 'reservation.confirmed' etc
  template_id    VARCHAR NOT NULL,   -- qual template foi usado
  payload        JSONB NOT NULL,     -- dados usados no template
  rendered_body  TEXT NOT NULL,      -- mensagem final renderizada
  
  -- Estado
  status         VARCHAR NOT NULL DEFAULT 'PENDING',
  -- PENDING | SENT | FAILED | DELIVERED
  
  -- Idempotência — um evento só gera uma notificação por destinatário
  UNIQUE (event_type, recipient_id, channel),
  
  sent_at        TIMESTAMP,
  failed_at      TIMESTAMP,
  error          TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

-- Templates por canal e evento
CREATE TABLE notification_templates (
  id         VARCHAR PRIMARY KEY,   -- 'reservation.confirmed.whatsapp'
  event_type VARCHAR NOT NULL,
  channel    VARCHAR NOT NULL,
  body       TEXT NOT NULL,         -- template com variáveis {{name}}, {{date}}
  active     BOOLEAN DEFAULT true,
  UNIQUE (event_type, channel)
);

-- Configuração por hotel + evento + canal
CREATE TABLE notification_routing_rules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id   UUID NOT NULL,
  event_type VARCHAR NOT NULL,
  channel    VARCHAR NOT NULL,   -- 'WHATSAPP' | 'EMAIL'
  
  -- Para quem esta regra se aplica
  recipient_type VARCHAR NOT NULL,  -- 'STAFF' | 'CUSTOMER' | 'ALL'
  
  -- Condições opcionais
  active           BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,     -- ex: '22:00' — não envia WhatsApp após isso
  quiet_hours_end   TIME,     -- ex: '08:00'
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (stay_id, event_type, channel, recipient_type)
);

-- Exemplo de dados
INSERT INTO notification_routing_rules VALUES
  -- Hotel A: confirmação vai para cliente por WhatsApp e email
  ('...', 'hotel-a', 'reservation.confirmed', 'WHATSAPP', 'CUSTOMER', true, '22:00', '08:00'),
  ('...', 'hotel-a', 'reservation.confirmed', 'EMAIL',    'CUSTOMER', true, null, null),
  -- Hotel A: sessão expirada vai só para staff por email
  ('...', 'hotel-a', 'session.expired',       'EMAIL',    'STAFF',    true, null, null),
  -- Hotel B: tudo por WhatsApp, sem email
  ('...', 'hotel-b', 'reservation.confirmed', 'WHATSAPP', 'ALL',      true, '23:00', '07:00');