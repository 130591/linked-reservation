/**
 * Seed a test reservation in HOLD status and print the frontend booking URL.
 *
 * Usage:
 *   source ~/.nvm/nvm.sh && nvm use 20.17.0
 *   cd backend
 *   npx ts-node --project tsconfig.json -e "$(cat scripts/seed-test-booking.ts)"
 *
 * Or just run via the npm script:
 *   npm run seed:booking
 */

import { Client } from 'pg'
import { randomUUID } from 'crypto'
import { createHmac } from 'crypto'

// ── Config ─────────────────────────────────────────────────────────────────

const DB = {
  host:     process.env.DATABASE_HOST     ?? 'localhost',
  port:     Number(process.env.DATABASE_PORT ?? 5432),
  user:     process.env.DATABASE_USERNAME ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME     ?? 'yield',
}

const RESERVATION_TOKEN_SECRET =
  process.env.RESERVATION_TOKEN_SECRET ?? 'test-secret-must-be-at-least-32-characters-long'

// The frontend dev server (Vite) runs on 5173 and proxies API calls to the backend on 3000
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

// ── Token helpers (mirrors reservation-token.ts) ────────────────────────────

// Session token — used by the booking wizard (ReservationTokenGuard)
// Format: base64url(sessionId).hmac
function generateSessionToken(sessionId: string): string {
  const payload = Buffer.from(sessionId).toString('base64url')
  const sig     = createHmac('sha256', RESERVATION_TOKEN_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client(DB)
  await client.connect()
  console.log(`Connected to ${DB.database}@${DB.host}:${DB.port}\n`)

  try {
    // 0. Clean up stale test HOLDs so previous seed runs don't block the new session
    const cleanup = await client.query(`
      UPDATE reservation.reservations
      SET status = 'EXPIRED', deleted_at = CURRENT_TIMESTAMP
      WHERE status = 'HOLD' AND deleted_at IS NULL
    `)
    console.log(`Expired ${cleanup.rowCount ?? 0} stale HOLD reservation(s)\n`)

    // 1. Find an existing room (we need room.external_id and a stay)
    const roomRow = await client.query<{
      room_id: number
      room_external_id: string
      room_name: string
      stay_external_id: string
      stay_name: string
    }>(`
      SELECT
        r.id            AS room_id,
        r.external_id   AS room_external_id,
        r.name          AS room_name,
        s.external_id   AS stay_external_id,
        s.name          AS stay_name
      FROM reservation.rooms r
      JOIN reservation.stays s ON s.external_id = r.stay_id
      WHERE r.deleted_at IS NULL AND s.deleted_at IS NULL
      LIMIT 1
    `)

    if (roomRow.rowCount === 0) {
      throw new Error(
        'No rooms found in the database.\n' +
        'Create a stay and room first (via the admin API or another seed script).'
      )
    }

    const { room_id, room_external_id, room_name, stay_external_id, stay_name } = roomRow.rows[0]
    console.log(`Using room  : "${room_name}" (${room_external_id})`)

    // Ensure the test room has a price — set to R$ 150/night if it's still 0
    await client.query(`
      UPDATE reservation.rooms SET price_per_night = 15000 WHERE id = $1 AND price_per_night = 0
    `, [room_id])
    console.log(`Using stay  : "${stay_name}" (${stay_external_id})`)

    // 2. Find a staff member for the session
    const staffRow = await client.query<{ staff_external_id: string; staff_name: string }>(`
      SELECT external_id AS staff_external_id, name AS staff_name
      FROM reservation.staff_members
      WHERE stay_id = $1 AND deleted_at IS NULL
      LIMIT 1
    `, [stay_external_id])

    let staffId: string
    if (staffRow.rowCount === 0) {
      staffId = randomUUID()
      console.log(`No staff found — inserting dummy staff (${staffId})`)
      await client.query(`
        INSERT INTO reservation.staff_members
          (external_id, stay_id, name, email, phone, role, is_available, max_concurrent_sessions, current_sessions)
        VALUES ($1, $2, 'Test Staff', 'staff@test.local', '+5511900000001', 'ATTENDANT', true, 10, 0)
      `, [staffId, stay_external_id])
    } else {
      staffId = staffRow.rows[0].staff_external_id
      console.log(`Using staff : "${staffRow.rows[0].staff_name}" (${staffId})`)
    }

    // 3. Create a reservation_session
    const sessionId  = randomUUID()
    const now        = new Date()
    const checkIn    = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7) // +7 days
    const checkOut   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9) // +9 days
    const sessionExp = new Date(Date.now() + 15 * 60 * 1000)                          // +15 min

    const sessionInsert = await client.query<{ id: number }>(`
      INSERT INTO reservation.reservation_sessions
        (external_id, stay_id, stay_name, check_in, check_out, guests, staff_id, status, expires_at)
      VALUES ($1, $2, $3, $4, $5, 2, $6, 'ACTIVE', $7)
      RETURNING id
    `, [sessionId, stay_external_id, stay_name, checkIn, checkOut, staffId, sessionExp])
    const sessionNumericId = sessionInsert.rows[0].id
    console.log(`Created session : ${sessionId}  (id=${sessionNumericId}, expires ${sessionExp.toISOString()})`)

    // The wizard creates the HOLD reservation when the user picks a room — don't pre-create it here.

    // 4. Generate session token and print booking URL
    const sessionToken = generateSessionToken(sessionId)
    const bookingUrl   = `${FRONTEND_URL}/booking?token=${sessionToken}`

    console.log('\n─────────────────────────────────────────────────────────')
    console.log('Booking wizard URL (session token, valid 15 min):')
    console.log(bookingUrl)
    console.log('─────────────────────────────────────────────────────────\n')
    console.log(`Session ID     : ${sessionId}\n`)

  } finally {
    await client.end()
  }
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
