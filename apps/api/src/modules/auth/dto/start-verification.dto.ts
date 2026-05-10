import { IsNotEmpty, IsString } from 'class-validator';

export class StartVerificationDto {
  @IsString()
  @IsNotEmpty()
  nid!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  fingerprintHash!: string;
}
