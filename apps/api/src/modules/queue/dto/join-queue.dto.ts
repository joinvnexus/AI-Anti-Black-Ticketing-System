import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class JoinQueueDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  journeyId!: string;

  @IsString()
  @IsNotEmpty()
  deviceId!: string;

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
}
