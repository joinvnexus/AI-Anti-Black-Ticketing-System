import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { AuthRepository } from './auth.repository';
import { StartVerificationDto } from './dto/start-verification.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

type PendingChallenge = {
  id: string;
  nidHash: string;
  phone: string;
  deviceId: string;
  fingerprintHash: string;
  otpCode: string;
  expiresAt: string;
};

@Injectable()
export class AuthService {
  private readonly challenges = new Map<string, PendingChallenge>();

  constructor(private readonly authRepository: AuthRepository) {}

  async startVerification(dto: StartVerificationDto) {
    const nidHash = this.hashValue(dto.nid);
    const otpCode = '123456';
    const challenge: PendingChallenge = {
      id: randomUUID(),
      nidHash,
      phone: dto.phone,
      deviceId: dto.deviceId,
      fingerprintHash: dto.fingerprintHash,
      otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    if (this.authRepository.enabled) {
      await this.authRepository.invalidateActiveChallenges(nidHash, dto.deviceId);
      const row = await this.authRepository.createOtpChallenge({
        nidHash,
        phone: dto.phone,
        deviceId: dto.deviceId,
        fingerprintHash: dto.fingerprintHash,
        codeHash: this.hashValue(otpCode),
        expiresAt: new Date(challenge.expiresAt),
      });

      challenge.id = row.id;
    } else {
      this.challenges.set(challenge.id, challenge);
    }

    return {
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt,
      nextStep: 'verify_otp',
      debugOtp: otpCode,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    let challenge = this.challenges.get(dto.challengeId) ?? null;

    if (this.authRepository.enabled) {
      const row = await this.authRepository.findOtpChallengeById(dto.challengeId);

      if (row) {
        challenge = {
          id: row.id,
          nidHash: row.nid_hash,
          phone: row.phone,
          deviceId: row.device_id,
          fingerprintHash: row.fingerprint_hash,
          otpCode: '',
          expiresAt: row.expires_at.toISOString(),
        };

        if (row.used_at || row.code_hash !== this.hashValue(dto.otpCode)) {
          throw new UnauthorizedException('Invalid OTP challenge');
        }
      }
    }

    if (!challenge || (!this.authRepository.enabled && challenge.otpCode !== dto.otpCode)) {
      throw new UnauthorizedException('Invalid OTP challenge');
    }

    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      this.challenges.delete(dto.challengeId);
      throw new UnauthorizedException('OTP challenge expired');
    }

    if (this.authRepository.enabled) {
      await this.authRepository.markOtpChallengeUsed(dto.challengeId);
      const user = await this.authRepository.createOrGetVerifiedUser({
        nidHash: challenge.nidHash,
        phone: challenge.phone,
      });

      await this.authRepository.upsertUserDevice({
        userId: user.id,
        deviceId: challenge.deviceId,
        fingerprintHash: challenge.fingerprintHash,
        trustScore: 60,
      });

      const session = await this.authRepository.createSession({
        userId: user.id,
        deviceId: challenge.deviceId,
        ipAddress: '0.0.0.0',
        riskScore: 10,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return {
        userId: user.id,
        sessionId: session.id,
        accessToken: `access_${randomUUID()}`,
        refreshToken: `refresh_${randomUUID()}`,
        deviceTrustScore: 60,
        sessionRiskScore: 10,
      };
    }

    this.challenges.delete(dto.challengeId);

    return {
      userId: randomUUID(),
      sessionId: randomUUID(),
      accessToken: `access_${randomUUID()}`,
      refreshToken: `refresh_${randomUUID()}`,
      deviceTrustScore: 60,
      sessionRiskScore: 10,
    };
  }

  private hashValue(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
