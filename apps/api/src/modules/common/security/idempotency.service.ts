import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { DatabaseService } from '../../database/database.service';

type MemoryIdempotencyRecord = {
  requestHash: string;
  status: 'started' | 'completed';
  responsePayload?: unknown;
};

@Injectable()
export class IdempotencyService {
  private readonly records = new Map<string, MemoryIdempotencyRecord>();

  constructor(private readonly databaseService: DatabaseService) {}

  async begin(scope: string, idempotencyKey: string, payload: unknown) {
    const requestHash = this.hash(payload);
    const compositeKey = `${scope}:${idempotencyKey}`;

    if (!this.databaseService.enabled) {
      const existing = this.records.get(compositeKey);

      if (existing && existing.requestHash !== requestHash) {
        throw new ConflictException('Idempotency key reused with different payload');
      }

      if (existing?.status === 'completed') {
        return {
          replayed: true,
          responsePayload: existing.responsePayload,
        };
      }

      this.records.set(compositeKey, {
        requestHash,
        status: 'started',
      });

      return { replayed: false };
    }

    const existing = await this.databaseService.query<{
      request_hash: string;
      status: 'started' | 'completed';
      response_payload: unknown | null;
    }>(
      `
        SELECT request_hash, status, response_payload
        FROM idempotency_keys
        WHERE scope = $1 AND idempotency_key = $2
      `,
      [scope, idempotencyKey],
    );

    const row = existing.rows[0];

    if (row) {
      if (row.request_hash !== requestHash) {
        throw new ConflictException('Idempotency key reused with different payload');
      }

      if (row.status === 'completed') {
        return { replayed: true, responsePayload: row.response_payload };
      }

      return { replayed: false };
    }

    await this.databaseService.query(
      `
        INSERT INTO idempotency_keys (scope, idempotency_key, request_hash, status)
        VALUES ($1, $2, $3, 'started')
      `,
      [scope, idempotencyKey, requestHash],
    );

    return { replayed: false };
  }

  async complete(scope: string, idempotencyKey: string, responsePayload: unknown) {
    const compositeKey = `${scope}:${idempotencyKey}`;

    if (!this.databaseService.enabled) {
      const record = this.records.get(compositeKey);

      if (record) {
        record.status = 'completed';
        record.responsePayload = responsePayload;
        this.records.set(compositeKey, record);
      }

      return;
    }

    await this.databaseService.query(
      `
        UPDATE idempotency_keys
        SET status = 'completed', response_payload = $3::jsonb, updated_at = NOW()
        WHERE scope = $1 AND idempotency_key = $2
      `,
      [scope, idempotencyKey, JSON.stringify(responsePayload)],
    );
  }

  private hash(payload: unknown) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
