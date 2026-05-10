import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { FeatureVectorEvent, KAFKA_TOPICS } from '../../contracts/domain-events';
import { AuditService } from '../common/audit/audit.service';
import { KafkaProducerService } from '../common/events/kafka-producer.service';
import { SubmitTelemetryDto } from './dto/submit-telemetry.dto';
import { TelemetryRepository } from './telemetry.repository';

@Injectable()
export class TelemetryService {
  private readonly memorySnapshots = new Map<string, Record<string, unknown>>();

  constructor(
    private readonly telemetryRepository: TelemetryRepository,
    private readonly auditService: AuditService,
    private readonly kafkaProducerService: KafkaProducerService,
  ) {}

  async submit(dto: SubmitTelemetryDto) {
    const extractedSignals = this.extractSignals(dto);
    const riskHint = this.calculateRiskHint(dto, extractedSignals);
    const featureVector = this.buildFeatureVector(dto, riskHint);

    if (!this.telemetryRepository.enabled) {
      const id = `${dto.deviceId}:${Date.now()}`;
      this.memorySnapshots.set(id, { ...dto, riskHint, extractedSignals, featureVector });
      await this.publishFeatureVector(id, dto, featureVector, extractedSignals);
      return {
        snapshotId: id,
        riskHint,
        extractedSignals,
        featureVector,
      };
    }

    const snapshot = await this.telemetryRepository.create({
      ...dto,
      riskHint,
      rawPayload: {
        userId: dto.userId ?? null,
        sessionId: dto.sessionId ?? null,
        deviceId: dto.deviceId,
        journeyId: dto.journeyId ?? null,
        mouseMovements: dto.mouseMovements,
        clickCount: dto.clickCount,
        typingSpeedCpm: dto.typingSpeedCpm,
        focusSwitchCount: dto.focusSwitchCount,
        pasteCount: dto.pasteCount,
        hesitationScore: dto.hesitationScore,
        formFillMs: dto.formFillMs,
        pageDwellMs: dto.pageDwellMs,
        featureVector,
      },
    });
    await this.publishFeatureVector(snapshot.id, dto, featureVector, extractedSignals);

    await this.auditService.record({
      actorUserId: dto.userId,
      action: 'telemetry.submit',
      resourceType: 'telemetry_snapshot',
      resourceId: snapshot.id,
      outcome: 'success',
      metadata: {
        deviceId: dto.deviceId,
        riskHint,
        extractedSignals,
        featureVector,
      },
    });

    return {
      snapshotId: snapshot.id,
      createdAt: snapshot.created_at.toISOString(),
      riskHint,
      extractedSignals,
      featureVector,
    };
  }

  async findSnapshot(snapshotId?: string | null) {
    if (!snapshotId) {
      return null;
    }

    if (!this.telemetryRepository.enabled) {
      const snapshot = this.memorySnapshots.get(snapshotId);
      return snapshot ?? null;
    }

    return this.telemetryRepository.findById(snapshotId);
  }

  async getFeatureVector(snapshotId: string) {
    const snapshot = await this.findSnapshot(snapshotId);

    if (!snapshot) {
      return {
        found: false,
      };
    }

    if ('featureVector' in snapshot) {
      return {
        found: true,
        snapshotId,
        featureVector: snapshot.featureVector,
      };
    }

    const rawPayload =
      'raw_payload' in snapshot && snapshot.raw_payload
        ? snapshot.raw_payload
        : {};

    return {
      found: true,
      snapshotId,
      featureVector:
        typeof rawPayload === 'object' && rawPayload && 'featureVector' in rawPayload
          ? rawPayload.featureVector
          : null,
    };
  }

  private calculateRiskHint(dto: SubmitTelemetryDto, extractedSignals: string[]) {
    return Math.min(
      100,
      Math.round(
        dto.hesitationScore * 0.35 +
          Math.min(dto.pasteCount * 10, 30) +
          Math.min(dto.focusSwitchCount * 5, 25) +
          (dto.typingSpeedCpm > 450 ? 20 : 0) +
          extractedSignals.length * 4,
      ),
    );
  }

  private extractSignals(dto: SubmitTelemetryDto) {
    const signals: string[] = [];

    if (dto.typingSpeedCpm >= 450) {
      signals.push('typing_speed_spike');
    }

    if (dto.pasteCount >= 2) {
      signals.push('paste_burst');
    }

    if (dto.focusSwitchCount >= 4) {
      signals.push('focus_switch_burst');
    }

    if (dto.pageDwellMs <= 3000 && dto.formFillMs <= 2500) {
      signals.push('low_dwell_fast_submit');
    }

    if (dto.mouseMovements <= Math.max(1, dto.clickCount)) {
      signals.push('low_pointer_entropy');
    }

    return signals;
  }

  private buildFeatureVector(dto: SubmitTelemetryDto, riskHint: number) {
    return {
      mouseToClickRatio:
        dto.clickCount === 0
          ? dto.mouseMovements
          : Number((dto.mouseMovements / dto.clickCount).toFixed(2)),
      typingSpeedCpm: dto.typingSpeedCpm,
      focusSwitchCount: dto.focusSwitchCount,
      pasteCount: dto.pasteCount,
      hesitationScore: dto.hesitationScore,
      formFillSeconds: Number((dto.formFillMs / 1000).toFixed(2)),
      dwellSeconds: Number((dto.pageDwellMs / 1000).toFixed(2)),
      riskHint,
    };
  }

  private async publishFeatureVector(
    snapshotId: string,
    dto: SubmitTelemetryDto,
    featureVector: Record<string, number>,
    extractedSignals: string[],
  ) {
    const event: FeatureVectorEvent = {
      eventId: randomUUID(),
      eventType: 'feature.vector.created',
      occurredAt: new Date().toISOString(),
      traceId: snapshotId,
      version: 1,
      producer: 'api',
      payload: {
        snapshotId,
        userId: dto.userId ?? null,
        journeyId: dto.journeyId ?? null,
        deviceId: dto.deviceId,
        vector: featureVector,
        signals: extractedSignals,
      },
    };

    await this.kafkaProducerService.publish(KAFKA_TOPICS.featureVectors, event);
  }
}
