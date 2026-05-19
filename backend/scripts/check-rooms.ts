import { Client } from 'pg'

async function main() {
  const client = new Client({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    user: process.env.DATABASE_USERNAME ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'yield',
  })
  await client.connect()

  console.log('\n=== ROOMS ===')
  const rooms = await client.query(`
    SELECT r.id, r.name, r.capacity, r.stay_id, r.price_per_night, r.deleted_at
    FROM reservation.rooms r ORDER BY r.id
  `)
  console.table(rooms.rows)

  console.log('\n=== STAYS ===')
  const stays = await client.query(`
    SELECT s.id, s.external_id, s.name, s.deleted_at FROM reservation.stays s ORDER BY s.id
  `)
  console.table(stays.rows)

  console.log('\n=== ACTIVE HOLDS/CONFIRMED ===')
  const holds = await client.query(`
    SELECT id, external_id, room_id, session_id, check_in, check_out, status, deleted_at
    FROM reservation.reservations
    WHERE status IN ('HOLD', 'CONFIRMED') AND deleted_at IS NULL
    ORDER BY check_in
  `)
  console.table(holds.rows)

  await client.end()
}

main().catch(err => { console.error(err); process.exit(1) })
