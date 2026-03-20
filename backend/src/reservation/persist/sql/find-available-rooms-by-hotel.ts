export const findAvailableRoomsByHotelSql = `
  SELECT 
    r.id,
    r.name,
    r.hotel_id as "hotelId",
    r.capacity,
    r.created_at as "createdAt",
    r.updated_at as "updatedAt"
  FROM rooms r
  WHERE r.hotel_id = $1
  AND r.capacity >= $2
  AND NOT EXISTS (
    SELECT 1
    FROM reservations res
    WHERE res.room_id = r.id
      AND res.status IN ('HOLD', 'CONFIRMED')
      AND res.deleted_at IS NULL
      AND (
        tstzrange(res.check_in, res.check_out, '[]') &&
        tstzrange($3, $4, '[]')
      )
  );
`
