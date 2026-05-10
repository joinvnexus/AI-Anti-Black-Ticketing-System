import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  get enabled() {
    return this.databaseService.enabled;
  }

  async createArtifact(input: {
    holdReference: string;
    provider: string;
    paymentReference: string;
    authorizationReference: string;
    amount: number;
    callbackSignature: string;
  }) {
    const result = await this.databaseService.query<{ id: string }>(
      `
        INSERT INTO payment_artifacts (
          hold_id,
          provider,
          payment_reference,
          authorization_reference,
          amount,
          callback_signature,
          provider_payload
        )
        VALUES (
          (SELECT id FROM seat_holds WHERE hold_reference = $1),
          $2, $3, $4, $5, $6, '{}'::jsonb
        )
        RETURNING id
      `,
      [
        input.holdReference,
        input.provider,
        input.paymentReference,
        input.authorizationReference,
        input.amount,
        input.callbackSignature,
      ],
    );

    return result.rows[0];
  }

  async findByPaymentReference(paymentReference: string) {
    const result = await this.databaseService.query<{
      id: string;
      hold_id: string | null;
      payment_reference: string;
      status: string;
      amount: number;
    }>(
      `
        SELECT id, hold_id, payment_reference, status, amount
        FROM payment_artifacts
        WHERE payment_reference = $1
      `,
      [paymentReference],
    );

    return result.rows[0] ?? null;
  }

  async updateStatus(paymentReference: string, status: string, payload: Record<string, unknown>) {
    await this.databaseService.query(
      `
        UPDATE payment_artifacts
        SET status = $2, provider_payload = $3::jsonb, updated_at = NOW()
        WHERE payment_reference = $1
      `,
      [paymentReference, status, JSON.stringify(payload)],
    );
  }
}
