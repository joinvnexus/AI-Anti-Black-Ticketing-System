import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshDeviceDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
