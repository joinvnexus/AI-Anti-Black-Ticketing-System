import { Body, Controller, Headers, Post } from '@nestjs/common';
import { BookingService } from './booking.service';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { CreateHoldDto } from './dto/create-hold.dto';

@Controller('v1/bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post('hold')
  createHold(@Body() dto: CreateHoldDto) {
    return this.bookingService.createHold(dto);
  }

  @Post('confirm')
  confirm(@Body() dto: ConfirmBookingDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.bookingService.confirm(dto, idempotencyKey ?? dto.holdReference);
  }

  @Post('cancel')
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
  redistribute(@Body() body: { journeyId: string }) {
    return this.bookingService.redistribute(body.journeyId);
  }
}
