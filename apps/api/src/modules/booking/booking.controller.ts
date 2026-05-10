import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { RequestSignatureGuard } from '../common/security/request-signature.guard';
import { BookingService } from './booking.service';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateHoldDto } from './dto/create-hold.dto';

@Controller('v1/bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post('hold')
  @UseGuards(RequestSignatureGuard)
  createHold(@Body() dto: CreateHoldDto) {
    return this.bookingService.createHold(dto);
  }

  @Post('confirm')
  @UseGuards(RequestSignatureGuard)
  confirm(@Body() dto: ConfirmBookingDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.bookingService.confirm(dto, idempotencyKey ?? dto.holdReference);
  }

  @Post('cancel')
  @UseGuards(RequestSignatureGuard)
  cancel(
    @Body()
    body: {
      bookingId: string;
      cancelledByUserId: string;
      reason: string;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingService.cancel({
      ...body,
      idempotencyKey: idempotencyKey ?? body.bookingId,
    });
  }

  @Post('redistribute')
  @UseGuards(RequestSignatureGuard)
  redistribute(@Body() body: { journeyId: string }) {
    return this.bookingService.redistribute(body.journeyId);
  }
}
