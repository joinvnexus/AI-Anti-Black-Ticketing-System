import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

type ChallengeRecord = {
  id: string;
  nid_hash: string;
  phone: string;
  device_id: string;
  fingerprint_hash: string;
  code_hash: string;
  expires_at: Date;
  used_at: Date | null;
};

type UserRecord = {
  id: string;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  get enabled() {
    return this.databaseService.enabled;
  }

  async createOtpChallenge(input: {
    nidHash: string;
    phone: string;
    deviceId: string;
    fingerprintHash: string;
    codeHash: string;
    expiresAt: Date;
  }) {
    const result = await this.databaseService.query<ChallengeRecord>(
      `
        INSERT INTO otp_challenges (nid_hash, phone, device_id, fingerprint_hash, code_hash, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, nid_hash, phone, device_id, fingerprint_hash, code_hash, expires_at, used_at
      `,
      [
        input.nidHash,
        input.phone,
        input.deviceId,
        input.fingerprintHash,
        input.codeHash,
        input.expiresAt,
      ],
    );

    return result.rows[0];
  }

  async invalidateActiveChallenges(nidHash: string, deviceId: string) {
    await this.databaseService.query(
      `
        UPDATE otp_challenges
        SET used_at = NOW()
        WHERE nid_hash = $1 AND device_id = $2 AND used_at IS NULL AND expires_at > NOW()
      `,
      [nidHash, deviceId],
    );
  }

  async findOtpChallengeById(id: string) {
    const result = await this.databaseService.query<ChallengeRecord>(
      `
        SELECT id, nid_hash, phone, device_id, fingerprint_hash, code_hash, expires_at, used_at
        FROM otp_challenges
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ?? null;
  }

  async markOtpChallengeUsed(id: string) {
    await this.databaseService.query(
      `
        UPDATE otp_challenges
        SET used_at = NOW()
        WHERE id = $1
      `,
      [id],
    );
  }

  async createOrGetVerifiedUser(input: { nidHash: string; phone: string }) {
    const result = await this.databaseService.query<UserRecord>(
      `
        INSERT INTO users (nid_hash, phone, status)
        VALUES ($1, $2, 'verified')
        ON CONFLICT (nid_hash)
        DO UPDATE SET phone = EXCLUDED.phone, status = 'verified', updated_at = NOW()
        RETURNING id
      `,
      [input.nidHash, input.phone],
    );

    return result.rows[0];
  }

  async upsertUserDevice(input: {
    userId: string;
    deviceId: string;
    fingerprintHash: string;
    trustScore: number;
  }) {
    await this.databaseService.query(
      `
        INSERT INTO user_devices (user_id, device_id, fingerprint_hash, trust_score, last_seen_at)
        VALUES ($1, $2, $3, $4, NOW())
      `,
      [input.userId, input.deviceId, input.fingerprintHash, input.trustScore],
    );
  }

  async createSession(input: {
    userId: string;
    deviceId: string;
    ipAddress: string;
    riskScore: number;
    expiresAt: Date;
  }) {
    const result = await this.databaseService.query<{ id: string }>(
      `
        INSERT INTO sessions (user_id, device_id, ip_address, risk_score, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [input.userId, input.deviceId, input.ipAddress, input.riskScore, input.expiresAt],
    );

    return result.rows[0];
  }
}
