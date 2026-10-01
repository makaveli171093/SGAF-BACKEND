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

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mockPayService: MockPayService,
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
        'Esta obligación financiera ya ha sido cancelada',
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
      currency: 'USD',
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
}
