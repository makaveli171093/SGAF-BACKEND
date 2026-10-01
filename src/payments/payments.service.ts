import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ObligationStatus,
  PaymentMethod,
  PaymentStatus,
} from '../generated/prisma/enums.js';

import { PrismaService } from '../database/prisma.service.js';
import { CreateOnlinePaymentDto } from './dto/create-online-payment.dto.js';
import { MockPayService } from './mockpay.service.js';
import { ConfigService } from '@nestjs/config';
import { MockPayWebhookDto } from './dto/mockpay-webhook.dto.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mockPayService: MockPayService,
    private readonly configService: ConfigService,
  ) {}
  async createOnlinePayment(userId: string, dto: CreateOnlinePaymentDto) {
    const obligation = await this.prisma.financialObligation.findUnique({
      where: {
        id: dto.obligationId,
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!obligation) {
      throw new NotFoundException('Obligación financiera no encontrada');
    }

    if (obligation.student.userId !== userId) {
      throw new ForbiddenException(
        'Esta obligación financiera no corresponde al usuario autenticado',
      );
    }

    if (obligation.status === ObligationStatus.PAID) {
      throw new ConflictException(
        'Esta obligación financiera ya ha sido pagada',
      );
    }

    if (obligation.status === ObligationStatus.CACELLED) {
      throw new ConflictException(
        'Esta obligación financiera ha sido cancelada',
      );
    }

    const existingPendingPayment = await this.prisma.payment.findFirst({
      where: {
        obligationId: dto.obligationId,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPendingPayment) {
      throw new ConflictException(
        'Ya existe un pago online pendiente para esta obligación financiera',
      );
    }

    const amount = Number(obligation.amount.toString());

    const mockPayResponse = await this.mockPayService.createPayment({
      amount,
      currency: this.configService.get<string>('MOCKPAY_CURRENCY', 'USD'),
      metadata: {
        obligationId: dto.obligationId,
        studentId: obligation.studentId,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        obligationId: obligation.id,
        amount: obligation.amount,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,

        externalReference: mockPayResponse.id,

        gatewayResponse: {
          id: mockPayResponse.id,
          checkout_url: mockPayResponse.checkout_url,
        },
      },
    });

    return {
      message: 'Intención de pago creada correctamente',
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        externalReference: payment.externalReference,
      },
      checkoutUrl: mockPayResponse.checkout_url,
    };
  }

  async handleMockPayWebhook(dto: MockPayWebhookDto) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        externalReference: dto.id,
      },
      include: {
        obligation: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(
        'No existe un pago asociado a la transacción recibida',
      );
    }
    if (
      dto.metadata?.obligation_id &&
      dto.metadata.obligation_id !== payment.obligationId
    ) {
      throw new BadRequestException(
        'La obligación informada por MockPay no coincide con el pago registrado',
      );
    }

    const paymentAmount = Number(payment.amount.toString());

    if (paymentAmount !== dto.amount) {
      throw new BadRequestException(
        'El monto informado por MockPay no coincide con el pago registrado',
      );
    }

    if (
      payment.status === PaymentStatus.APPROVED ||
      payment.status === PaymentStatus.REJECTED
    ) {
      return {
        message: 'Webhook ya procesado anteriormente',
        paymentId: payment.id,
        status: payment.status,
      };
    }
    const gatewayResponse = {
      event: dto.event,
      id: dto.id,
      amount: dto.amount,
      currency: dto.currency,
      status: dto.status,
      failure_reason: dto.failure_reason ?? null,
      metadata: dto.metadata,
      created_at: dto.created_at,
    };

    if (dto.status === 'SUCCEEDED') {
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            status: PaymentStatus.APPROVED,
            gatewayResponse,
          },
        });

        const updatedObligation = await tx.financialObligation.update({
          where: {
            id: payment.obligationId,
          },
          data: {
            status: ObligationStatus.PAID,
          },
        });

        return {
          updatedPayment,
          updatedObligation,
        };
      });

      return {
        message: 'Pago aprobado correctamente',
        payment: result.updatedPayment,
        obligation: result.updatedObligation,
      };
    }
    const rejectedPayment = await this.prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: PaymentStatus.REJECTED,
        gatewayResponse,
      },
    });

    return {
      message: 'Pago rechazado por MockPay',
      payment: rejectedPayment,
    };
  }
}
