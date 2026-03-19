export const sql = `
      select 
        id,
        room_id as "roomId",
        session_id as "sessionId",
        check_in as "checkIn",
        check_out as "checkOut",
        status,
        expires_at as "expiresAt",
        deleted_at as "deletedAt"
      from reservations
      where tstzrange(check_in::timestamp, check_out::timestamp, '[]') && tstzrange($1::timestamp, $2::timestamp, '[]')
      and status in ('HOLD', 'CONFIRMED')
      and deleted_at is null;
`