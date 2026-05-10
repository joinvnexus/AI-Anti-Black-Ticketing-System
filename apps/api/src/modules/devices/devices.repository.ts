import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DevicesRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  get enabled() {
    return this.databaseService.enabled;
  }

  async findDevice(userId: string, deviceId: string) {
    const result = await this.databaseService.query<{
      id: string;
      trust_score: number;
      fingerprint_hash: string;
    }>(
      `
        SELECT id, trust_score, fingerprint_hash
        FROM user_devices
        WHERE user_id = $1 AND device_id = $2
        ORDER BY last_seen_at DESC
        LIMIT 1
      `,
      [userId, deviceId],
    );

    return result.rows[0] ?? null;
  }

  async upsertDevice(input: {
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

  async refreshDevice(userId: string, deviceId: string) {
    await this.databaseService.query(
      `
        UPDATE user_devices
        SET last_seen_at = NOW()
        WHERE user_id = $1 AND device_id = $2
      `,
      [userId, deviceId],
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
