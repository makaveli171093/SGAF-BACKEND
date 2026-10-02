import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Patch,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import { CreateOnlinePaymentDto } from './dto/create-online-payment.dto.js';
import { PaymentsService } from './payments.service.js';
import { MockPayWebhookDto } from './dto/mockpay-webhook.dto.js';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto.js';
import { VerifyManualPaymentDto } from './dto/verify-manual-payment.dto.js';
import { CreateApplicantOnlinePaymentDto } from './dto/create-applicant-online-payment.dto.js';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('online')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  createOnlinePayment(
    @Body() dto: CreateOnlinePaymentDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.paymentsService.createOnlinePayment(req.user.id, dto);
  }

  @Post('webhook')
  handleWebhook(@Body() dto: MockPayWebhookDto) {
    return this.paymentsService.handleMockPayWebhook(dto);
  }

  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECEPCIONIST)
  createManualPayment(@Body() dto: CreateManualPaymentDto) {
    return this.paymentsService.createManualPayment(dto);
  }

  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECEPCIONIST)
  verifyManualPayment(
    @Param('id') paymentId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: VerifyManualPaymentDto,
  ) {
    return this.paymentsService.verifyManualPayment(
      paymentId,
      req.user.id,
      dto,
    );
  }

  @Post('applicant/online')
  createApplicantOnlinePayment(@Body() dto: CreateApplicantOnlinePaymentDto) {
    return this.paymentsService.createApplicantOnlinePayment(dto);
  }
}
