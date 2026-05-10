import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  get enabled() {
    return this.databaseService.enabled;
  }

  async createArtifact(input: {
    userId: string;
    queueToken: string;
    provider: string;
    paymentReference: string;
    authorizationReference: string;
    amount: number;
    callbackSignature: string;
    seatCount: number;
    journeyId: string;
  }) {
    const result = await this.databaseService.query<{ id: string }>(
      `
        INSERT INTO payment_artifacts (
          user_id,
          provider,
          payment_reference,
          authorization_reference,
          queue_token,
          amount,
          callback_signature,
          provider_payload
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb
        )
        RETURNING id
      `,
      [
        input.userId,
        input.provider,
        input.paymentReference,
        input.authorizationReference,
        input.queueToken,
        input.amount,
        input.callbackSignature,
        JSON.stringify({ seatCount: input.seatCount, journeyId: input.journeyId }),
      ],
    );

    return result.rows[0];
  }

  async findByPaymentReference(paymentReference: string) {
    const result = await this.databaseService.query<{
      id: string;
      user_id: string | null;
      hold_id: string | null;
      queue_token: string | null;
      payment_reference: string;
      provider: string;
      status: string;
      amount: number;
      provider_payload: Record<string, unknown>;
    }>(
      `
        SELECT id, user_id, hold_id, queue_token, payment_reference, provider, status, amount, provider_payload
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

  async attachHold(paymentReference: string, holdReference: string) {
    await this.databaseService.query(
      `
        UPDATE payment_artifacts
        SET hold_id = (SELECT id FROM seat_holds WHERE hold_reference = $2), updated_at = NOW()
        WHERE payment_reference = $1
      `,
      [paymentReference, holdReference],
    );
  }
}
