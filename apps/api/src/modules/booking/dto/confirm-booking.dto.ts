import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmBookingDto {
  @IsString()
  @IsNotEmpty()
  holdReference!: string;

  @IsString()
  @IsNotEmpty()
  paymentReference!: string;
}
