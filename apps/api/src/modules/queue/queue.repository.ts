import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type QueueTokenRecord = {
  token: string;
  user_id: string;
  journey_id: string;
  device_id: string | null;
  device_trust_score: number;
  risk_score: number;
  queue_bucket: number;
  priority_score: number;
  eligibility_reason: string | null;
  telemetry_snapshot_id: string | null;
  reservation_expires_at: Date | null;
  status: 'waiting' | 'deprioritized' | 'eligible' | 'reserved' | 'expired';
  expires_at: Date;
};

@Injectable()
export class QueueRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  get enabled() {
    return this.databaseService.enabled;
  }

  async create(input: {
    userId: string;
    journeyId: string;
    deviceId: string;
    token: string;
    queueBucket: number;
    priorityScore: number;
    deviceTrustScore: number;
    riskScore: number;
    telemetrySnapshotId?: string | null;
    eligibilityReason: string;
    status: 'waiting' | 'deprioritized' | 'eligible';
    expiresAt: Date;
  }) {
    const result = await this.databaseService.query<QueueTokenRecord>(
      `
        INSERT INTO queue_tokens (
          user_id,
          journey_id,
          device_id,
          token,
          queue_bucket,
          device_trust_score,
          priority_score,
          risk_score,
          telemetry_snapshot_id,
          eligibility_reason,
          status,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING token, user_id, journey_id, device_id, device_trust_score, risk_score, queue_bucket,
          priority_score, eligibility_reason, telemetry_snapshot_id, reservation_expires_at, status, expires_at
      `,
      [
        input.userId,
        input.journeyId,
        input.deviceId,
        input.token,
        input.queueBucket,
        input.deviceTrustScore,
        input.priorityScore,
        input.riskScore,
        input.telemetrySnapshotId ?? null,
        input.eligibilityReason,
        input.status,
        input.expiresAt,
      ],
    );

    return result.rows[0];
  }

  async findByToken(token: string) {
    const result = await this.databaseService.query<QueueTokenRecord>(
      `
        SELECT token, user_id, journey_id, device_id, device_trust_score, risk_score, queue_bucket,
          priority_score, eligibility_reason, telemetry_snapshot_id, reservation_expires_at, status, expires_at
        FROM queue_tokens
        WHERE token = $1
      `,
      [token],
    );

    return result.rows[0] ?? null;
  }

  async consumeReservation(token: string) {
    const result = await this.databaseService.query<QueueTokenRecord>(
      `
        UPDATE queue_tokens
        SET status = 'expired', reservation_consumed_at = NOW()
        WHERE token = $1
          AND status = 'reserved'
          AND reservation_expires_at IS NOT NULL
          AND reservation_expires_at > NOW()
        RETURNING token, user_id, journey_id, device_id, device_trust_score, risk_score, queue_bucket,
          priority_score, eligibility_reason, telemetry_snapshot_id, reservation_expires_at, status, expires_at
      `,
      [token],
    );

    return result.rows[0] ?? null;
  }

  async getDeviceTrust(userId: string, deviceId: string) {
    const result = await this.databaseService.query<{ trust_score: number }>(
      `
        SELECT trust_score
        FROM user_devices
        WHERE user_id = $1 AND device_id = $2
        ORDER BY last_seen_at DESC
        LIMIT 1
      `,
      [userId, deviceId],
    );

    return result.rows[0]?.trust_score ?? null;
  }

  async getActiveCooldown(userId: string, journeyId: string) {
    const result = await this.databaseService.query<{ expires_at: Date; reason: string }>(
      `
        SELECT expires_at, reason
        FROM queue_cooldowns
        WHERE user_id = $1 AND journey_id = $2 AND expires_at > NOW()
        ORDER BY expires_at DESC
        LIMIT 1
      `,
      [userId, journeyId],
    );

    return result.rows[0] ?? null;
  }

  async getBookingLimit(userId: string) {
    const result = await this.databaseService.query<{
      weekly_limit: number;
      monthly_limit: number;
      weekly_booked_count: number;
      monthly_booked_count: number;
      cooldown_until: Date | null;
    }>(
      `
        SELECT weekly_limit, monthly_limit, weekly_booked_count, monthly_booked_count, cooldown_until
        FROM booking_limits
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId],
    );

    return result.rows[0] ?? null;
  }

  async reserveTopEligible(journeyId: string, reservationExpiresAt: Date) {
    const result = await this.databaseService.query<QueueTokenRecord>(
      `
        UPDATE queue_tokens
        SET status = 'reserved', reservation_expires_at = $2
        WHERE token = (
          SELECT token
          FROM queue_tokens
          WHERE journey_id = $1
            AND status IN ('eligible', 'waiting')
            AND expires_at > NOW()
          ORDER BY queue_bucket ASC, priority_score DESC, created_at ASC, token ASC
          LIMIT 1
        )
        RETURNING token, user_id, journey_id, device_id, device_trust_score, risk_score, queue_bucket,
          priority_score, eligibility_reason, telemetry_snapshot_id, reservation_expires_at, status, expires_at
      `,
      [journeyId, reservationExpiresAt],
    );

    return result.rows[0] ?? null;
  }

  async addCooldown(input: {
    userId: string;
    journeyId: string;
    deviceId?: string | null;
    reason: string;
    expiresAt: Date;
  }) {
    await this.databaseService.query(
      `
        INSERT INTO queue_cooldowns (user_id, device_id, journey_id, reason, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [input.userId, input.deviceId ?? null, input.journeyId, input.reason, input.expiresAt],
    );
  }
}
