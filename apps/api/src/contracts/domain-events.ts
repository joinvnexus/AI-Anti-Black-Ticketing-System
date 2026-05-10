export const KAFKA_TOPICS = {
  authVerification: 'auth.verification.v1',
  riskAssessment: 'risk.assessment.v1',
  queueState: 'queue.state.v1',
  bookingLifecycle: 'booking.lifecycle.v1',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

export type DomainEventEnvelope<TEventType extends string, TPayload> = {
  eventId: string;
  eventType: TEventType;
  occurredAt: string;
  traceId: string;
  version: 1;
  producer: 'api' | 'risk-service';
  payload: TPayload;
};

export type AuthVerificationEvent =
  | DomainEventEnvelope<
      'auth.challenge.created',
      {
        challengeId: string;
        nidHash: string;
        phone: string;
        deviceId: string;
        fingerprintHash: string;
        expiresAt: string;
      }
    >
  | DomainEventEnvelope<
      'auth.otp.verified',
      {
        challengeId: string;
        userId: string;
        deviceId: string;
        deviceTrustScore: number;
        sessionRiskScore: number;
      }
    >
  | DomainEventEnvelope<
      'auth.otp.rejected',
      {
        challengeId: string;
        reason: 'invalid_code' | 'expired' | 'rate_limited';
        deviceId: string;
      }
    >;

export type RiskAssessmentEvent = DomainEventEnvelope<
  'risk.assessment.completed',
  {
    subjectType: 'auth' | 'queue' | 'booking' | 'payment';
    subjectId: string;
    score: number;
    band: 'low' | 'medium' | 'high' | 'extreme';
    actions: string[];
    reasons: string[];
  }
>;

export type QueueStateEvent = DomainEventEnvelope<
  | 'queue.joined'
  | 'queue.deprioritized'
  | 'queue.eligible'
  | 'queue.reservation.issued'
  | 'queue.expired',
  {
    token: string;
    userId: string;
    journeyId: string;
    queueBucket: number;
    riskScore: number;
    status: string;
    expiresAt: string;
  }
>;

export type BookingLifecycleEvent = DomainEventEnvelope<
  | 'booking.hold.created'
  | 'booking.hold.expired'
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.redistribution.enqueued',
  {
    holdReference?: string;
    bookingId?: string;
    userId: string;
    journeyId: string;
    seatCount?: number;
    riskScore?: number;
    paymentReference?: string;
    status: string;
  }
>;

export type DomainEvent =
  | AuthVerificationEvent
  | RiskAssessmentEvent
  | QueueStateEvent
  | BookingLifecycleEvent;
