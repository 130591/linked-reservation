CREATE TABLE rooms (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  hotel_id UUID NOT NULL,
  
  capacity INT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reservation_sessions (
  id UUID PRIMARY KEY,
  hotel_id UUID NOT NULL,
  
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL,
  
  status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'COMPLETED', 'EXPIRED')),
  expires_at TIMESTAMP NOT NULL,
  
  customer JSONB,
  version INT DEFAULT 1,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reservations (
  id UUID PRIMARY KEY,
  
  room_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES reservation_sessions(id),
  
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  
  status TEXT NOT NULL CHECK(status IN ('HOLD', 'CONFIRMED', 'EXPIRED')),
  expires_at TIMESTAMP NOT NULL,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations
ADD CONSTRAINT no_overlapping_reservations
EXCLUDE USING gist (
  room_id WITH =, 
  tstzrange(check_in::timestamp, check_out::timestamp, '[]') WITH &&
) WHERE (status IN ('HOLD', 'CONFIRMED'));