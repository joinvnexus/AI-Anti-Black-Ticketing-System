import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { StartVerificationDto } from './dto/start-verification.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('start-nid-verification')
  startVerification(@Body() dto: StartVerificationDto) {
    return this.authService.startVerification(dto);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }
}

