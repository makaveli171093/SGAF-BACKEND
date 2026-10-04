import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ObligationStatus,
  ObligationType,
  PaymentMethod,
  PaymentStatus,
  UserStatus,
} from '../generated/prisma/enums.js';

import { PrismaService } from '../database/prisma.service.js';
import { CreateOnlinePaymentDto } from './dto/create-online-payment.dto.js';
import { MockPayService } from './mockpay.service.js';
import { ConfigService } from '@nestjs/config';
import { MockPayWebhookDto } from './dto/mockpay-webhook.dto.js';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto.js';
import { VerifyManualPaymentDto } from './dto/verify-manual-payment.dto.js';
import { CreateApplicantOnlinePaymentDto } from './dto/create-applicant-online-payment.dto.js';

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
    await this.syncStudentDebtStatus(payment.obligation.studentId);
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

  async createManualPayment(dto: CreateManualPaymentDto) {
    const obligation = await this.prisma.financialObligation.findUnique({
      where: {
        id: dto.obligationId,
      },
    });

    if (!obligation) {
      throw new NotFoundException('La obligación financiera no existe');
    }

    if (
      obligation.status === ObligationStatus.PAID ||
      obligation.status === ObligationStatus.CACELLED
    ) {
      throw new BadRequestException(
        'La obligación no puede recibir nuevos pagos',
      );
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        obligationId: obligation.id,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPayment) {
      throw new ConflictException(
        'Ya existe un pago pendiente para esta obligación',
      );
    }

    if (dto.method === PaymentMethod.BANK_TRANSFER && !dto.receiptNumber) {
      throw new BadRequestException(
        'El número de comprobante es obligatorio para transferencias bancarias',
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          obligationId: obligation.id,
          amount: obligation.amount,
          method: dto.method,
          status: PaymentStatus.PENDING,

          receiptNumber:
            dto.method === PaymentMethod.BANK_TRANSFER
              ? dto.receiptNumber
              : null,
        },
      });

      if (dto.method === PaymentMethod.CASH) {
        const year = new Date().getFullYear();

        const generatedReceiptNumber = `CASH-${year}-${createdPayment.id.slice(0, 8).toUpperCase()}`;

        return tx.payment.update({
          where: {
            id: createdPayment.id,
          },
          data: {
            receiptNumber: generatedReceiptNumber,
          },
        });
      }

      return createdPayment;
    });

    return {
      message: 'Pago manual registrado correctamente',
      payment,
    };
  }

  async verifyManualPayment(
    paymentId: string,
    verifierUserId: string,
    dto: VerifyManualPaymentDto,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        obligation: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('El pago no existe');
    }

    if (payment.method === PaymentMethod.ONLINE) {
      throw new BadRequestException(
        'Los pagos online son verificados automáticamente por MockPay',
      );
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException('Este pago ya fue verificado anteriormente');
    }

    if (dto.status === PaymentStatus.APPROVED) {
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: {
            id: payment.id,
          },
          data: {
            status: PaymentStatus.APPROVED,
            verifyBy: {
              connect: {
                id: verifierUserId,
              },
            },
            verfiedAt: new Date(),
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
      await this.syncStudentDebtStatus(payment.obligation.studentId);

      return {
        message: 'Pago manual aprobado correctamente',
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
        verifyBy: {
          connect: {
            id: verifierUserId,
          },
        },
        verfiedAt: new Date(),
      },
    });

    return {
      message: 'Pago manual rechazado correctamente',
      payment: rejectedPayment,
    };
  }

  async syncStudentDebtStatus(studentId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: {
        id: studentId,
      },
      include: {
        user: true,
        financialObligations: true,
      },
    });

    if (!student) {
      throw new NotFoundException('El estudiante no existe');
    }

    const now = new Date();

    const hasOverdueDebt = student.financialObligations.some(
      (obligation) =>
        obligation.status !== ObligationStatus.PAID &&
        obligation.status !== ObligationStatus.CACELLED &&
        obligation.dueDate < now,
    );

    if (hasOverdueDebt) {
      if (student.user.status !== UserStatus.SUSPEND_FOR_DEBT) {
        await this.prisma.user.update({
          where: {
            id: student.userId,
          },
          data: {
            status: UserStatus.SUSPEND_FOR_DEBT,
          },
        });
      }

      return {
        SUSPEND: true,
        status: UserStatus.SUSPEND_FOR_DEBT,
      };
    }

    if (student.user.status === UserStatus.SUSPEND_FOR_DEBT) {
      await this.prisma.user.update({
        where: {
          id: student.userId,
        },
        data: {
          status: UserStatus.ACTIVE,
        },
      });
    }

    return {
      SUSPEND: false,
      status: UserStatus.ACTIVE,
    };
  }

  async createApplicantOnlinePayment(dto: CreateApplicantOnlinePaymentDto) {
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
      throw new NotFoundException('La obligación financiera no existe');
    }

    if (obligation.student.enrollmentCode !== dto.enrollmentCode) {
      throw new ForbiddenException(
        'El código de matrícula no corresponde a esta obligación',
      );
    }

    if (obligation.student.user.status !== UserStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        'Este usuario ya no se encuentra pendiente de aprobación',
      );
    }

    if (obligation.type !== ObligationType.ENROLLMENT) {
      throw new BadRequestException(
        'Solo se puede pagar la obligación inicial de matrícula por este medio',
      );
    }

    if (
      obligation.status === ObligationStatus.PAID ||
      obligation.status === ObligationStatus.CACELLED
    ) {
      throw new BadRequestException(
        'La obligación no puede recibir nuevos pagos',
      );
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        obligationId: obligation.id,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,
      },
    });

    if (existingPayment) {
      throw new ConflictException(
        'Ya existe una intención de pago pendiente para esta obligación',
      );
    }

    const amount = Number(obligation.amount.toString());

    const currency = this.configService.get<string>('MOCKPAY_CURRENCY', 'USD');

    const mockPayPayment = await this.mockPayService.createPayment({
      amount,
      currency,
      metadata: {
        obligation_id: obligation.id,
        student_id: obligation.studentId,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        obligationId: obligation.id,
        amount: obligation.amount,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,
        externalReference: mockPayPayment.id,
        gatewayResponse: {
          id: mockPayPayment.id,
          checkout_url: mockPayPayment.checkout_url,
        },
      },
    });

    return {
      message: 'Intención de pago de matrícula creada correctamente',
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        externalReference: payment.externalReference,
      },
      checkoutUrl: mockPayPayment.checkout_url,
    };
  }

  async getMyFinancialHistory(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: {
        userId,
      },
    });

    if (!student) {
      throw new NotFoundException(
        'No existe un perfil estudiantil asociado al usuario',
      );
    }

    const obligations = await this.prisma.financialObligation.findMany({
      where: {
        studentId: student.id,
      },
      include: {
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        dueDate: 'desc',
      },
    });

    return {
      message: 'Historial financiero obtenido correctamente',
      financialHistory: obligations,
    };
  }

  async getPendingObligations() {
    const obligations = await this.prisma.financialObligation.findMany({
      where: {
        status: {
          in: [ObligationStatus.PENDING, ObligationStatus.OVERDUE],
        },
      },

      select: {
        id: true,
        type: true,
        description: true,
        amount: true,
        dueDate: true,
        status: true,
        createdAt: true,

        student: {
          select: {
            enrollmentCode: true,

            user: {
              select: {
                firstName: true,
                lastName: true,
                ci: true,
                phone: true,
                status: true,
              },
            },
          },
        },
      },

      orderBy: {
        dueDate: 'asc',
      },
    });

    return {
      message: 'Obligaciones financieras pendientes obtenidas correctamente',
      obligations,
    };
  }
}
