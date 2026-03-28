-- ========================================
-- LINKED RESERVATION SCHEMA V2 - SIMPLIFIED
-- ========================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ========================================
-- EXISTING TABLES (with modifications)
-- ========================================

-- Stays/Hotels - Adicionar whatsapp_number
ALTER TABLE stays 
ADD COLUMN whatsapp_number VARCHAR(255);

CREATE INDEX idx_stays_whatsapp_lookup 
ON stays(whatsapp_number) 
WHERE whatsapp_number IS NOT NULL;

-- Rooms - Adicionar foreign key explícito
ALTER TABLE rooms 
ADD CONSTRAINT fk_rooms_stay 
FOREIGN KEY (stay_id) REFERENCES stays(id) ON DELETE CASCADE;

CREATE INDEX idx_rooms_stay_capacity 
ON rooms(stay_id, capacity DESC, name);

-- Reservation Sessions - Estender com campos de conversa
ALTER TABLE reservation_sessions 
ADD COLUMN phone VARCHAR(20),
ADD COLUMN assigned_staff_id UUID NULL,
ADD COLUMN last_message_at TIMESTAMP NULL;

-- Adicionar foreign keys
ALTER TABLE reservation_sessions 
ADD CONSTRAINT fk_reservation_sessions_staff 
FOREIGN KEY (assigned_staff_id) REFERENCES staff_members(id) ON DELETE SET NULL;

-- Remover coluna redundante
ALTER TABLE reservation_sessions DROP COLUMN stay_name;

-- ========================================
-- NEW TABLES
-- ========================================

-- Staff Members - Para escalação de atendimento (5% dos casos)
CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'ATTENDANT' CHECK (role IN ('ATTENDANT', 'MANAGER', 'OWNER')),
  is_available BOOLEAN DEFAULT true,
  max_concurrent_sessions INT DEFAULT 5,
  current_sessions INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (stay_id) REFERENCES stays(id) ON DELETE CASCADE
);

-- ========================================
-- PERFORMANCE INDEXES
-- ========================================

-- Reservation sessions lookup (hot path)
CREATE INDEX CONCURRENTLY idx_reservation_sessions_phone_stay 
ON reservation_sessions(phone, stay_id) 
WHERE status = 'ACTIVE';

-- Staff availability para escalação
CREATE INDEX CONCURRENTLY idx_staff_members_available 
ON staff_members(stay_id, is_available, current_sessions, max_concurrent_sessions)
WHERE is_available = true AND current_sessions < max_concurrent_sessions;

-- Staff dashboard
CREATE INDEX CONCURRENTLY idx_reservation_sessions_staff_active 
ON reservation_sessions(assigned_staff_id, last_message_at) 
WHERE assigned_staff_id IS NOT NULL AND status = 'ACTIVE';

-- ========================================
-- VIEWS FOR ANALYTICS
-- ========================================

-- Dashboard de conversas por hotel
CREATE VIEW conversation_dashboard AS
SELECT 
  s.id as stay_id,
  s.name as stay_name,
  COUNT(rs.id) as total_sessions,
  COUNT(CASE WHEN rs.assigned_staff_id IS NULL THEN 1 END) as bot_handled,
  COUNT(CASE WHEN rs.assigned_staff_id IS NOT NULL THEN 1 END) as escalated,
  AVG(EXTRACT(EPOCH FROM (rs.updated_at - rs.created_at))/60) as avg_duration_minutes
FROM stays s
LEFT JOIN reservation_sessions rs ON s.id = rs.stay_id
WHERE rs.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY s.id, s.name;

-- Staff performance
CREATE VIEW staff_performance AS
SELECT 
  sm.id,
  sm.name,
  sm.stay_id,
  COUNT(rs.id) as handled_sessions,
  AVG(EXTRACT(EPOCH FROM (rs.updated_at - rs.created_at))/60) as avg_handling_time,
  COUNT(CASE WHEN rs.status = 'COMPLETED' THEN 1 END) as resolved_sessions
FROM staff_members sm
LEFT JOIN reservation_sessions rs ON sm.id = rs.assigned_staff_id
GROUP BY sm.id, sm.name, sm.stay_id;
