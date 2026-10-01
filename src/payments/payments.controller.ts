import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

import { CreateOnlinePaymentDto } from './dto/create-online-payment.dto.js';
import { PaymentsService } from './payments.service.js';

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
}
