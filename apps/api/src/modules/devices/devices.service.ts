import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { RefreshDeviceDto } from './dto/refresh-device.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { DevicesRepository } from './devices.repository';

@Injectable()
export class DevicesService {
  private readonly memoryDevices = new Map<string, { fingerprintHash: string; trustScore: number }>();

  constructor(
    private readonly devicesRepository: DevicesRepository,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDeviceDto) {
    const key = `${dto.userId}:${dto.deviceId}`;

    if (!this.devicesRepository.enabled) {
      const existing = this.memoryDevices.get(key);
      const trustScore = existing?.fingerprintHash === dto.fingerprintHash ? 75 : existing ? 30 : 60;
      this.memoryDevices.set(key, {
        fingerprintHash: dto.fingerprintHash,
        trustScore,
      });

      return {
        deviceId: dto.deviceId,
        trustScore,
      };
    }

    const existing = await this.devicesRepository.findDevice(dto.userId, dto.deviceId);
    const trustScore = existing
      ? existing.fingerprint_hash === dto.fingerprintHash
        ? Math.min(100, Math.round(existing.trust_score + 5))
        : Math.max(10, Math.round(existing.trust_score - 20))
      : 60;

    await this.devicesRepository.upsertDevice({
      userId: dto.userId,
      deviceId: dto.deviceId,
      fingerprintHash: dto.fingerprintHash,
      trustScore,
    });

    await this.auditService.record({
      actorUserId: dto.userId,
      action: 'device.register',
      resourceType: 'user_device',
      resourceId: dto.deviceId,
      outcome: 'success',
      metadata: {
        trustScore,
      },
    });

    return {
      deviceId: dto.deviceId,
      trustScore,
    };
  }

  async refresh(dto: RefreshDeviceDto) {
    if (!this.devicesRepository.enabled) {
      return {
        deviceId: dto.deviceId,
        refreshed: true,
      };
    }

    await this.devicesRepository.refreshDevice(dto.userId, dto.deviceId);
    const session = await this.devicesRepository.createSession({
      userId: dto.userId,
      deviceId: dto.deviceId,
      ipAddress: dto.ipAddress ?? '0.0.0.0',
      riskScore: 10,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await this.auditService.record({
      actorUserId: dto.userId,
      action: 'device.refresh',
      resourceType: 'session',
      resourceId: session.id,
      outcome: 'success',
      metadata: {
        deviceId: dto.deviceId,
      },
    });

    return {
      deviceId: dto.deviceId,
      sessionId: session.id,
      refreshed: true,
    };
  }
}
