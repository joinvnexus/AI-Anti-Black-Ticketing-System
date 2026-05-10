import { IsIn, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class PreauthorizePaymentDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  holdReference!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsIn(['sslcommerz', 'bkash', 'nagad'])
  provider!: 'sslcommerz' | 'bkash' | 'nagad';
}
