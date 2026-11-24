import { serializable } from '../common/serializable.js';
import {
  BadRequestException,
  BadGatewayException,
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
import { publicUserSelect } from '../common/selects/user-public.select.js';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mockPayService: MockPayService,
    private readonly configService: ConfigService,
  ) {}

  private async prepareCheckout(obligationId: string, actorId: string) {
    const reserved = await serializable(this.prisma, async (tx) => {
      const obligation = await tx.financialObligation.findUnique({
        where: { id: obligationId },
      });
      if (
        !obligation ||
        obligation.status === 'PAID' ||
        obligation.status === 'CACELLED'
      )
        throw new ConflictException('La obligación no puede recibir pagos');
      const existing = await tx.payment.findFirst({
        where: { obligationId, status: { in: ['PENDING', 'APPROVED'] } },
      });
      if (existing) {
        const payload = existing.gatewayResponse;
        if (
          existing.method === 'ONLINE' &&
          existing.status === 'PENDING' &&
          payload &&
          typeof payload === 'object' &&
          'checkout_url' in payload &&
          typeof payload.checkout_url === 'string'
        )
          return {
            payment: existing,
            obligation,
            checkoutUrl: payload.checkout_url,
          };
        throw new ConflictException(
          'Ya existe un pago pendiente o aprobado para esta obligación. Si el proveedor no respondió, solicita conciliación antes de reintentar.',
        );
      }
      const payment = await tx.payment.create({
        data: {
          obligationId,
          amount: obligation.amount,
          method: 'ONLINE',
          status: 'PENDING',
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'PAYMENT_RESERVED',
          entityId: payment.id,
          detail:
            'Reserva de pago en línea; pendiente de respuesta del proveedor',
        },
      });
      return { payment, obligation };
    });
    if ('checkoutUrl' in reserved)
      return {
        message: 'Intención de pago existente',
        payment: reserved.payment,
        checkoutUrl: reserved.checkoutUrl,
      };
    const response = await this.mockPayService
      .createPayment({
        amount: Number(reserved.obligation.amount.toString()),
        currency: this.configService.get<string>('MOCKPAY_CURRENCY', 'USD'),
        metadata: {
          obligation_id: obligationId,
          student_id: reserved.obligation.studentId,
          payment_id: reserved.payment.id,
        },
        webhook_url:
          this.configService.getOrThrow<string>('APP_BASE_URL') +
          '/api/v1/payments/webhook?token=' +
          encodeURIComponent(
            this.configService.getOrThrow<string>('MOCKPAY_WEBHOOK_SECRET'),
          ),
      })
      .catch(async () => {
        await this.prisma.auditEvent.create({
          data: {
            actorId,
            action: 'PAYMENT_RECONCILIATION_REQUIRED',
            entityId: reserved.payment.id,
            detail:
              'No se confirmó la respuesta del proveedor; reserva conservada para evitar doble cobro',
          },
        });
        throw new BadGatewayException(
          'El proveedor no confirmó el pago. No vuelvas a pagarlo: solicita conciliación en recepción.',
        );
      });
    const payment = await this.prisma.payment.update({
      where: { id: reserved.payment.id },
      data: {
        externalReference: response.id,
        gatewayResponse: {
          id: response.id,
          checkout_url: response.checkout_url,
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
      checkoutUrl: response.checkout_url,
    };
  }

  async createOnlinePayment(userId: string, dto: CreateOnlinePaymentDto) {
    const obligation = await this.prisma.financialObligation.findUnique({
      where: {
        id: dto.obligationId,
      },
      include: {
        student: {
          include: {
            user: { select: publicUserSelect },
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

    return this.prepareCheckout(obligation.id, userId);
  }

  async handleMockPayWebhook(dto: MockPayWebhookDto) {
    const result = await serializable(this.prisma, async (tx) => {
      let payment = await tx.payment.findUnique({
        where: { externalReference: dto.id },
        include: { obligation: true },
      });
      if (!payment && typeof dto.metadata?.payment_id === 'string') {
        payment = await tx.payment.findUnique({
          where: { id: dto.metadata.payment_id },
          include: { obligation: true },
        });
        if (
          payment &&
          (payment.method !== 'ONLINE' ||
            (payment.externalReference && payment.externalReference !== dto.id))
        )
          throw new BadRequestException(
            'La referencia del proveedor no corresponde a esta reserva',
          );
      }
      if (!payment)
        throw new NotFoundException(
          'No existe un pago asociado a la transacción recibida',
        );
      const obligationIds = [
        dto.metadata?.obligation_id,
        dto.metadata?.obligationId,
      ].filter((id) => id !== undefined);
      const studentIds = [
        dto.metadata?.student_id,
        dto.metadata?.studentId,
      ].filter((id) => id !== undefined);
      if (
        obligationIds.some((id) => id !== payment.obligationId) ||
        studentIds.some((id) => id !== payment.obligation.studentId)
      )
        throw new BadRequestException(
          'La obligación informada por MockPay no coincide con el pago registrado',
        );
      if (Number(payment.amount.toString()) !== dto.amount)
        throw new BadRequestException(
          'El monto informado por MockPay no coincide con el pago registrado',
        );
      if (
        dto.currency !==
        this.configService.get<string>('MOCKPAY_CURRENCY', 'USD')
      )
        throw new BadRequestException(
          'La moneda informada por MockPay no coincide con la configurada',
        );
      if (payment.status !== 'PENDING')
        return {
          message: 'Webhook ya procesado anteriormente',
          paymentId: payment.id,
          status: payment.status,
          payment,
          obligation: payment.obligation,
        };
      if (
        payment.obligation.status === 'PAID' ||
        payment.obligation.status === 'CACELLED'
      )
        throw new ConflictException(
          'La obligación ya fue liquidada o cancelada',
        );
      const status =
        dto.status === 'SUCCEEDED'
          ? PaymentStatus.APPROVED
          : PaymentStatus.REJECTED;
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status,
          externalReference: dto.id,
          verfiedAt: new Date(),
          gatewayResponse: {
            event: dto.event,
            id: dto.id,
            amount: dto.amount,
            currency: dto.currency,
            status: dto.status,
            failure_reason: dto.failure_reason ?? null,
            metadata: dto.metadata,
            created_at: dto.created_at,
          },
        },
      });
      const obligation =
        status === 'APPROVED'
          ? await tx.financialObligation.update({
              where: { id: payment.obligationId },
              data: { status: 'PAID' },
            })
          : payment.obligation;
      await tx.auditEvent.create({
        data: {
          actorId: 'mockpay',
          action: 'PAYMENT_' + status,
          entityId: payment.id,
          detail: 'Confirmación del proveedor de pagos',
        },
      });
      return {
        message:
          status === 'APPROVED'
            ? 'Pago aprobado correctamente'
            : 'Pago rechazado por MockPay',
        payment: updated,
        obligation,
      };
    });
    if (dto.status === 'SUCCEEDED')
      await this.syncStudentDebtStatus(result.obligation.studentId);
    return result;
  }

  async createManualPayment(dto: CreateManualPaymentDto, actorId = 'system') {
    return serializable(this.prisma, async (tx) => {
      const obligation = await tx.financialObligation.findUnique({
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

      const existingPayment = await tx.payment.findFirst({
        where: {
          obligationId: obligation.id,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.APPROVED] },
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

      const payment = await (async () => {
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
      })();

      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'PAYMENT_CREATED',
          entityId: payment.id,
          detail: 'Pago manual registrado pendiente de verificación',
        },
      });
      return {
        message: 'Pago manual registrado correctamente',
        payment,
      };
    });
  }

  async verifyManualPayment(
    paymentId: string,
    verifierUserId: string,
    dto: VerifyManualPaymentDto,
  ) {
    const result = await serializable(this.prisma, async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { obligation: true },
      });
      if (!payment) throw new NotFoundException('El pago no existe');
      if (payment.method === 'ONLINE')
        throw new BadRequestException(
          'Los pagos online son verificados automáticamente por MockPay',
        );
      if (payment.status !== 'PENDING')
        throw new ConflictException(
          'Este pago ya fue verificado anteriormente',
        );
      if (
        payment.obligation.status === 'PAID' ||
        payment.obligation.status === 'CACELLED'
      )
        throw new ConflictException(
          'La obligación ya fue liquidada o cancelada',
        );
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: dto.status,
          verifiedById: verifierUserId,
          verfiedAt: new Date(),
        },
      });
      const obligation =
        dto.status === 'APPROVED'
          ? await tx.financialObligation.update({
              where: { id: payment.obligationId },
              data: { status: 'PAID' },
            })
          : payment.obligation;
      await tx.auditEvent.create({
        data: {
          actorId: verifierUserId,
          action: 'PAYMENT_' + dto.status,
          entityId: paymentId,
          detail: 'Verificación manual de pago',
        },
      });
      return {
        message:
          dto.status === 'APPROVED'
            ? 'Pago manual aprobado correctamente'
            : 'Pago manual rechazado correctamente',
        payment: updatedPayment,
        obligation,
      };
    });
    if (dto.status === 'APPROVED')
      await this.syncStudentDebtStatus(result.obligation.studentId);
    return result;
  }

  async syncStudentDebtStatus(studentId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: {
        id: studentId,
      },
      include: {
        user: { select: publicUserSelect },
        financialObligations: true,
      },
    });

    if (!student) {
      throw new NotFoundException('El estudiante no existe');
    }

    if (
      student.user.status === UserStatus.INACTIVE ||
      student.user.status === UserStatus.PENDING_APPROVAL
    ) {
      return { SUSPEND: false, status: student.user.status };
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
            status: UserStatus.ACTIVE,
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
          status: UserStatus.SUSPEND_FOR_DEBT,
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
            user: { select: publicUserSelect },
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

    return this.prepareCheckout(obligation.id, obligation.student.userId);
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

    const { status: userStatus } = await this.syncStudentDebtStatus(student.id);

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
      userStatus,
    };
  }

  async getPendingManualPayments() {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        method: { in: [PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER] },
      },
      include: {
        obligation: {
          include: {
            student: {
              select: {
                id: true,
                enrollmentCode: true,
                user: { select: publicUserSelect },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return {
      message: 'Pagos manuales pendientes obtenidos correctamente',
      payments,
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
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            receiptNumber: true,
            createdAt: true,
            verfiedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },

        student: {
          select: {
            enrollmentCode: true,

            user: {
              select: publicUserSelect,
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
