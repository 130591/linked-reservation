export const findAvailableRoomsByHotelSql = `
  SELECT
    r.id,
    r.external_id AS "externalId",
    r.name,
    r.stay_id         AS "stayId",
    r.capacity,
    r.price_per_night AS "pricePerNight",
    r.created_at  AS "createdAt",
    r.updated_at  AS "updatedAt"
  FROM reservation.rooms r
  WHERE r.stay_id = $1
    AND r.capacity >= $2
    AND r.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM reservation.reservations res
      WHERE res.room_id = r.id
        AND res.status IN ('HOLD', 'CONFIRMED')
        AND res.deleted_at IS NULL
        AND tstzrange(res.check_in, res.check_out, '[]') &&
            tstzrange($3, $4, '[]')
    );
`
