import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ScoreRiskDto {
  @IsInt()
  @Min(0)
  @Max(100)
  deviceRisk!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  behaviorRisk!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  networkRisk!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  accountRisk!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  bookingRisk!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  paymentRisk!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  signals?: string[];

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['auth', 'queue', 'booking', 'payment'])
  subjectType?: 'auth' | 'queue' | 'booking' | 'payment';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  telemetryRiskHint?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  deviceTrustScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  weeklyBookingCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyBookingCount?: number;

  @IsOptional()
  @IsString()
  telemetrySnapshotId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  typingSpeedCpm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  syndicateRisk?: number;
}
