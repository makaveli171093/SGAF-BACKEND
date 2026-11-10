import { describe, it, expect, vi } from 'vitest';
import { PaymentsService } from './payments.service.js';
import {
  UserStatus,
  PaymentStatus,
  ObligationStatus,
} from '../generated/prisma/enums.js';

function setup(status: UserStatus = UserStatus.ACTIVE, overdue = false) {
  const student = {
    id: 'student-1',
    userId: 'user-1',
    user: { status },
    financialObligations: overdue
      ? [{ status: ObligationStatus.PENDING, dueDate: new Date(0) }]
      : [],
  };
  const payment = {
    id: 'payment-1',
    obligationId: 'obligation-1',
    amount: 200,
    status: PaymentStatus.PENDING,
    obligation: { studentId: 'student-1' },
  };
  const prisma = {
    studentProfile: { findUnique: vi.fn().mockResolvedValue(student) },
    user: { update: vi.fn().mockResolvedValue({}) },
    payment: {
      findUnique: vi.fn().mockResolvedValue(payment),
      update: vi.fn().mockResolvedValue({}),
    },
    financialObligation: { update: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) =>
    fn(prisma),
  );
  return {
    prisma,
    payment,
    service: new PaymentsService(prisma as never, {} as never, {} as never),
  };
}
const webhook = {
  id: 'external-1',
  amount: 200,
  currency: 'USD',
  status: 'SUCCEEDED' as const,
  event: 'payment.succeeded',
  metadata: { obligation_id: 'obligation-1', student_id: 'student-1' },
  created_at: '2026-11-09T12:00:00Z',
};

describe('Mora y pagos', () => {
  it.each([UserStatus.INACTIVE, UserStatus.PENDING_APPROVAL])(
    'preserva %s con y sin deuda',
    async (status) => {
      for (const overdue of [true, false]) {
        const { service, prisma } = setup(status, overdue);
        expect((await service.syncStudentDebtStatus('student-1')).status).toBe(
          status,
        );
        expect(prisma.user.update).not.toHaveBeenCalled();
      }
    },
  );
  it('suspende al activo con deuda vencida', async () => {
    const { service, prisma } = setup(UserStatus.ACTIVE, true);
    expect((await service.syncStudentDebtStatus('student-1')).SUSPEND).toBe(
      true,
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: UserStatus.SUSPEND_FOR_DEBT },
      }),
    );
  });
  it('reactiva al suspendido cuando no queda deuda', async () => {
    const { service, prisma } = setup(UserStatus.SUSPEND_FOR_DEBT);
    expect((await service.syncStudentDebtStatus('student-1')).status).toBe(
      UserStatus.ACTIVE,
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: UserStatus.ACTIVE } }),
    );
  });
  it('sincroniza la mora después de aprobar online', async () => {
    const { service, prisma } = setup(UserStatus.SUSPEND_FOR_DEBT);
    await service.handleMockPayWebhook(webhook);
    expect(prisma.financialObligation.update).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
    expect(
      prisma.financialObligation.update.mock.invocationCallOrder[0],
    ).toBeLessThan(prisma.user.update.mock.invocationCallOrder[0]);
  });
  it('no duplica un pago aprobado y reintenta sincronizar su estado', async () => {
    const { service, prisma, payment } = setup(UserStatus.SUSPEND_FOR_DEBT);
    payment.status = PaymentStatus.APPROVED;
    await service.handleMockPayWebhook(webhook);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
  });
  it('rechaza monto incorrecto sin modificar datos', async () => {
    const { service, prisma } = setup();
    await expect(
      service.handleMockPayWebhook({ ...webhook, amount: 1 }),
    ).rejects.toThrow('monto');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    { obligation_id: 'ajena' },
    { student_id: 'ajeno' },
    { obligationId: 'ajena' },
    { studentId: 'ajeno' },
  ])('rechaza metadatos ajenos %j', async (metadata) => {
    const { service, prisma } = setup();
    await expect(
      service.handleMockPayWebhook({ ...webhook, metadata }),
    ).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('acepta metadatos históricos para intenciones existentes', async () => {
    const { service } = setup();
    await expect(
      service.handleMockPayWebhook({
        ...webhook,
        metadata: {
          obligationId: 'obligation-1',
          studentId: 'student-1',
        },
      }),
    ).resolves.toHaveProperty('message', 'Pago aprobado correctamente');
  });
  it('rechaza el pago fallido sin marcar la obligación pagada', async () => {
    const { service, prisma } = setup();
    await service.handleMockPayWebhook({ ...webhook, status: 'FAILED' });
    expect(prisma.financialObligation.update).not.toHaveBeenCalled();
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.REJECTED }),
      }),
    );
  });
});

describe('Mora en historial financiero', () => {
  it.each([UserStatus.ACTIVE, UserStatus.SUSPEND_FOR_DEBT])(
    'retorna el estado sincronizado %s y conserva el historial',
    async (status) => {
      const prisma = {
        studentProfile: { findUnique: vi.fn().mockResolvedValue({ id: 's1' }) },
        financialObligation: {
          findMany: vi.fn().mockResolvedValue([{ id: 'o1' }]),
        },
      };
      const service = new PaymentsService(
        prisma as never,
        {} as never,
        {} as never,
      );
      const sync = vi
        .spyOn(service, 'syncStudentDebtStatus')
        .mockResolvedValue({
          status,
          SUSPEND: status === UserStatus.SUSPEND_FOR_DEBT,
        });
      const result = await service.getMyFinancialHistory('u1');
      expect(result.userStatus).toBe(status);
      expect(result.financialHistory).toEqual([{ id: 'o1' }]);
      expect(sync).toHaveBeenCalledWith('s1');
      expect(sync.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.financialObligation.findMany.mock.invocationCallOrder[0],
      );
    },
  );
});
