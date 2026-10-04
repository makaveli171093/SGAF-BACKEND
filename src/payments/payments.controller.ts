import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Patch,
  Param,
  Get,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
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
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({
    summary: 'Consultar historial financiero propio',
    description:
      'Uso: STUDENT autenticado. Devuelve todas sus obligaciones financieras y los pagos asociados a cada una, incluyendo intentos aprobados, rechazados o pendientes.',
  })
  @Get('my-history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  getMyFinancialHistory(@Req() req: { user: { id: string } }) {
    return this.paymentsService.getMyFinancialHistory(req.user.id);
  }

  @ApiOperation({
    summary: 'Consultar obligaciones financieras pendientes',
    description:
      'Uso: RECEPCIONIST autenticado. Devuelve las obligaciones financieras pendientes o vencidas de los estudiantes, con la información necesaria para identificar al alumno y gestionar el cobro.',
  })
  @Get('pending-obligations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECEPCIONIST)
  getPendingObligations() {
    return this.paymentsService.getPendingObligations();
  }

  @ApiOperation({
    summary: 'Crear intención de pago online',
    description:
      'Uso: STUDENT autenticado y ACTIVE. Recibe una obligación financiera propia y crea una intención de pago en MockPay. Devuelve checkoutUrl. El estado final se actualiza mediante webhook.',
  })
  @Post('online')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  createOnlinePayment(
    @Body() dto: CreateOnlinePaymentDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.paymentsService.createOnlinePayment(req.user.id, dto);
  }

  @ApiOperation({
    summary: 'Recibir confirmación de MockPay',
    description:
      'Uso: MockPay, no requiere JWT. Recibe el resultado asíncrono de una transacción. SUCCEEDED cambia Payment a APPROVED y la obligación a PAID; FAILED cambia Payment a REJECTED. El procesamiento es idempotente. Valida un token secreto antes de procesar el resultado asíncrono de la transacción.',
  })
  @Post('webhook')
  async handleWebhook(
    @Query('token') token: string,
    @Body() dto: MockPayWebhookDto,
  ) {
    if (!token || token !== process.env.MOCKPAY_WEBHOOK_SECRET) {
      throw new UnauthorizedException('Webhook no autorizado');
    }

    return this.paymentsService.handleMockPayWebhook(dto);
  }

  @ApiOperation({
    summary: 'Registrar pago manual',
    description:
      'Uso: RECEPTIONIST. Registra un pago presencial mediante CASH o BANK_TRANSFER para una obligación pendiente. El monto se toma de la obligación y el Payment se crea inicialmente en estado PENDING.',
  })
  @Post('manual')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECEPCIONIST)
  createManualPayment(@Body() dto: CreateManualPaymentDto) {
    return this.paymentsService.createManualPayment(dto);
  }

  @ApiOperation({
    summary: 'Verificar pago manual',
    description:
      'Uso: RECEPTIONIST. Aprueba o rechaza un Payment manual PENDING. Si se aprueba, el Payment pasa a APPROVED, la obligación a PAID y se registra quién y cuándo realizó la verificación.',
  })
  @Patch(':id/verify')
  @ApiBearerAuth()
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

  @ApiOperation({
    summary: 'Pagar matrícula inicial como postulante',
    description:
      'Uso: público para STUDENT en estado PENDING_APPROVAL. Requiere obligationId y enrollmentCode obtenidos al registrarse. Crea una intención de pago en MockPay y devuelve checkoutUrl. Después del pago, el webhook actualiza el estado del Payment y de la obligación financiera.',
  })
  @Post('applicant/online')
  createApplicantOnlinePayment(@Body() dto: CreateApplicantOnlinePaymentDto) {
    return this.paymentsService.createApplicantOnlinePayment(dto);
  }
}
