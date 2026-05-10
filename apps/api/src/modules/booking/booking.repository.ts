import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type SeatHoldRecord = {
  id: string;
  hold_reference: string;
  user_id: string;
  journey_id: string;
  queue_token: string | null;
  seat_count: number;
  status: 'held' | 'confirmed' | 'expired';
  expires_at: Date;
};

@Injectable()
export class BookingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  get enabled() {
    return this.databaseService.enabled;
  }

  async createHold(input: {
    userId: string;
    journeyId: string;
    holdReference: string;
    queueToken: string;
    seatCount: number;
    expiresAt: Date;
  }) {
    const result = await this.databaseService.query<SeatHoldRecord>(
      `
        INSERT INTO seat_holds (user_id, journey_id, hold_reference, queue_token, seat_count, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, hold_reference, user_id, journey_id, queue_token, seat_count, status, expires_at
      `,
      [input.userId, input.journeyId, input.holdReference, input.queueToken, input.seatCount, input.expiresAt],
    );

    return result.rows[0];
  }

  async findHoldByReference(holdReference: string) {
    const result = await this.databaseService.query<SeatHoldRecord>(
      `
        SELECT id, hold_reference, user_id, journey_id, queue_token, seat_count, status, expires_at
        FROM seat_holds
        WHERE hold_reference = $1
      `,
      [holdReference],
    );

    return result.rows[0] ?? null;
  }

  async confirmHold(holdReference: string) {
    await this.databaseService.query(
      `
        UPDATE seat_holds
        SET status = 'confirmed'
        WHERE hold_reference = $1
      `,
      [holdReference],
    );
  }

  async expireHold(holdReference: string) {
    await this.databaseService.query(
      `
        UPDATE seat_holds
        SET status = 'expired'
        WHERE hold_reference = $1
      `,
      [holdReference],
    );
  }

  async createBooking(input: {
    userId: string;
    journeyId: string;
    holdId?: string | null;
    riskScore: number;
    totalAmount: number;
    paymentReference?: string | null;
  }) {
    const result = await this.databaseService.query<{ id: string }>(
      `
        INSERT INTO bookings (user_id, journey_id, hold_id, risk_score, total_amount, payment_reference, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
        RETURNING id
      `,
      [
        input.userId,
        input.journeyId,
        input.holdId ?? null,
        input.riskScore,
        input.totalAmount,
        input.paymentReference ?? null,
      ],
    );

    return result.rows[0];
  }

  async findBookingById(bookingId: string) {
    const result = await this.databaseService.query<{
      id: string;
      user_id: string;
      journey_id: string;
      hold_id: string | null;
      status: string;
      payment_reference: string | null;
    }>(
      `
        SELECT id, user_id, journey_id, hold_id, status, payment_reference
        FROM bookings
        WHERE id = $1
      `,
      [bookingId],
    );

    return result.rows[0] ?? null;
  }

  async cancelBooking(bookingId: string) {
    const result = await this.databaseService.query<{
      id: string;
      user_id: string;
      journey_id: string;
      status: string;
    }>(
      `
        UPDATE bookings
        SET status = 'cancelled', cancelled_at = NOW()
        WHERE id = $1
        RETURNING id, user_id, journey_id, status
      `,
      [bookingId],
    );

    return result.rows[0] ?? null;
  }

  async createCancellation(input: {
    bookingId: string;
    cancelledByUserId: string;
    reason: string;
  }) {
    await this.databaseService.query(
      `
        INSERT INTO booking_cancellations (booking_id, cancelled_by_user_id, reason, refund_status)
        VALUES ($1, $2, $3, 'pending')
      `,
      [input.bookingId, input.cancelledByUserId, input.reason],
    );
  }

  async createRedistribution(input: {
    bookingId: string;
    journeyId: string;
    releasedSeatCount: number;
  }) {
    const result = await this.databaseService.query<{
      id: string;
      status: string;
    }>(
      `
        INSERT INTO seat_redistributions (booking_id, journey_id, released_seat_count, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING id, status
      `,
      [input.bookingId, input.journeyId, input.releasedSeatCount],
    );

    return result.rows[0];
  }

  async assignRedistribution(redistributionId: string, queueToken: string, assignedUserId: string) {
    const result = await this.databaseService.query<{
      id: string;
      status: string;
      queue_token: string | null;
      assigned_user_id: string | null;
    }>(
      `
        UPDATE seat_redistributions
        SET queue_token = $2, assigned_user_id = $3, status = 'assigned', updated_at = NOW()
        WHERE id = $1
        RETURNING id, status, queue_token, assigned_user_id
      `,
      [redistributionId, queueToken, assignedUserId],
    );

    return result.rows[0] ?? null;
  }

  async getBestQueueToken(journeyId: string) {
    const result = await this.databaseService.query<{ token: string; user_id: string }>(
      `
        SELECT token, user_id
        FROM queue_tokens
        WHERE journey_id = $1
          AND status IN ('eligible', 'waiting')
          AND expires_at > NOW()
        ORDER BY queue_bucket ASC, priority_score DESC, created_at ASC, token ASC
        LIMIT 1
      `,
      [journeyId],
    );

    return result.rows[0] ?? null;
  }

  async decrementJourneyAvailability(journeyId: string, seatCount: number) {
    const result = await this.databaseService.query<{ id: string; available_seats: number }>(
      `
        UPDATE journeys
        SET available_seats = available_seats - $2
        WHERE id = $1 AND available_seats >= $2
        RETURNING id, available_seats
      `,
      [journeyId, seatCount],
    );

    return result.rows[0] ?? null;
  }

  async incrementJourneyAvailability(journeyId: string, seatCount: number) {
    await this.databaseService.query(
      `
        UPDATE journeys
        SET available_seats = available_seats + $2
        WHERE id = $1
      `,
      [journeyId, seatCount],
    );
  }

  async incrementBookingLimit(userId: string) {
    await this.databaseService.query(
      `
        UPDATE booking_limits
        SET weekly_booked_count = weekly_booked_count + 1,
          monthly_booked_count = monthly_booked_count + 1,
          last_booking_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
      `,
      [userId],
    );
  }
}
