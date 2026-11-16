import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OperationsService } from './operations.service.js';
import { ProfileDto, AvatarDto, UserStatusDto } from './operations.dto.js';
import { OperationsController } from './operations.controller.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('new-hash'),
  },
}));
function setup() {
  const period = {
    id: 'p1',
    startDate: new Date('2026-11-01T04:00:00Z'),
    endDate: new Date('2026-12-01T03:59:59Z'),
    status: 'CLOSED',
  };
  const user = {
    id: 'u1',
    role: 'STUDENT',
    status: 'ACTIVE',
    stundentProfile: { id: 's1' },
    passwordHash: 'old-hash',
    tokenVersion: 0,
  };
  const tx = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue([]),
    },
    teacherProfile: {
      findUnique: vi.fn().mockResolvedValue({ user: { status: 'ACTIVE' } }),
      update: vi.fn(),
    },
    academicPeriod: {
      findUnique: vi.fn().mockResolvedValue(period),
      update: vi
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...period, ...data }),
        ),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    subject: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'sub1', active: true, credits: 3 }),
      update: vi.fn(),
    },
    enrollment: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([{ studentId: 's1' }]),
    },
    assignment: { count: vi.fn().mockResolvedValue(0) },
    group: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: 'g1',
          teacherId: 't1',
          subjectId: 'sub1',
          academicPeriodId: 'p1',
          academicPeriod: { ...period, status: 'ACTIVE' },
          scheduleBlocks: [],
        }),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    scheduleBlock: {
      findUnique: vi.fn().mockResolvedValue({ id: 'b1', groupId: 'g1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    financialObligation: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    payment: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi
      .fn()
      .mockImplementation((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
  };
  return {
    prisma,
    tx,
    period,
    user,
    service: new OperationsService(prisma as never),
  };
}
const groupDto = {
  name: 'A',
  maxCapacity: 10,
  subjectId: 'sub1',
  academicPeriodId: 'p1',
  teacherId: 't1',
};
const scheduleDto = {
  groupId: 'g1',
  dayOfWeek: 'MONDAY' as const,
  startTime: '09:00',
  endTime: '10:00',
};
describe('Mejoras operativas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });
  afterEach(() => vi.useRealTimers());
  it('reabre un periodo vigente y registra quién, cuándo y por qué', async () => {
    const { service, tx, prisma } = setup();
    const result = await service.reopen(
      'p1',
      'Cierre accidental confirmado',
      'admin1',
    );
    expect(result.period.status).toBe('ACTIVE');
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin1',
        entityId: 'p1',
        action: 'PERIOD_REOPENED',
        detail: 'ACTIVE: Cierre accidental confirmado',
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });
  it('un periodo futuro regresa a planificado', async () => {
    const { service, period } = setup();
    period.startDate = new Date('2026-11-20');
    expect(
      (await service.reopen('p1', 'Cierre por equivocación', 'a')).period
        .status,
    ).toBe('PLANNED');
  });
  it('rechaza reabrir un periodo vencido', async () => {
    const { service, period, tx } = setup();
    period.endDate = new Date('2026-11-14');
    await expect(
      service.reopen('p1', 'Cierre accidental', 'a'),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.academicPeriod.update).not.toHaveBeenCalled();
  });
  it('rechaza reabrir un periodo ya activo', async () => {
    const { service, period } = setup();
    period.status = 'ACTIVE';
    await expect(
      service.reopen('p1', 'Cierre accidental', 'a'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('no permite inactivar la cuenta propia', async () => {
    const { service, tx } = setup();
    await expect(
      service.userStatus('u1', 'INACTIVE', 'u1'),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it('protege al último administrador activo', async () => {
    const { service, user, tx } = setup();
    user.role = 'ADMIN';
    tx.user.count.mockResolvedValue(1);
    await expect(
      service.userStatus('u1', 'INACTIVE', 'other'),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it('reactivar no elimina la restricción por mora', async () => {
    const { service, user, tx } = setup();
    user.status = 'INACTIVE';
    tx.financialObligation.count.mockResolvedValue(1);
    await service.userStatus('u1', 'ACTIVE', 'admin');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { status: 'SUSPEND_FOR_DEBT', tokenVersion: { increment: 1 } },
    });
  });
  it('no salta la aprobación de postulantes', async () => {
    const { service, user } = setup();
    user.status = 'PENDING_APPROVAL';
    await expect(
      service.userStatus('u1', 'ACTIVE', 'admin'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('cambia contraseña con verificación y revoca sesiones', async () => {
    const { service, tx } = setup();
    await service.password('u1', {
      currentPassword: 'actual123',
      newPassword: 'distinta123',
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', passwordHash: 'old-hash' },
      data: { passwordHash: 'new-hash', tokenVersion: { increment: 1 } },
    });
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });
  it('rechaza contraseña actual incorrecta', async () => {
    const { service, tx } = setup();
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    await expect(
      service.password('u1', {
        currentPassword: 'incorrecta',
        newPassword: 'distinta123',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
  it('limita contraseña por bytes UTF-8', async () => {
    const { service } = setup();
    await expect(
      service.password('u1', {
        currentPassword: 'actual123',
        newPassword: '🔑'.repeat(20),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rechaza imagen cuyo contenido no coincide con su MIME', async () => {
    const { service, tx } = setup();
    await expect(
      service.avatar('u1', 'data:image/png;base64,aG9sYQ=='),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it('elimina foto sin eliminar datos personales', async () => {
    const { service, tx } = setup();
    await service.avatar('u1', null);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { avatarData: null },
      }),
    );
  });
  it('no modifica obligaciones al cambiar tarifas', async () => {
    const { service, tx } = setup();
    await service.editSubject(
      'sub1',
      {
        code: 'P1',
        name: 'Programación',
        credits: 3,
        enrollmentFee: 50,
        monthlyFee: 120,
        active: true,
      },
      'a',
    );
    expect(tx.subject.update).toHaveBeenCalled();
    expect(tx.financialObligation.findMany).not.toHaveBeenCalled();
  });
  it('protege créditos de materias con historial', async () => {
    const { service, tx } = setup();
    tx.enrollment.count.mockResolvedValue(1);
    await expect(
      service.editSubject(
        'sub1',
        {
          code: 'P1',
          name: 'Programación',
          credits: 5,
          enrollmentFee: 50,
          monthlyFee: 120,
          active: true,
        },
        'a',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(tx.subject.update).not.toHaveBeenCalled();
  });
  it('no reduce capacidad bajo los inscritos activos', async () => {
    const { service, period, tx } = setup();
    period.status = 'ACTIVE';
    tx.enrollment.count.mockResolvedValue(11);
    await expect(service.editGroup('g1', groupDto, 'a')).rejects.toMatchObject({
      status: 400,
    });
    expect(tx.group.update).not.toHaveBeenCalled();
  });
  it('no mueve de materia un grupo con historial', async () => {
    const { service, period, tx } = setup();
    period.status = 'ACTIVE';
    tx.enrollment.count.mockResolvedValue(1);
    await expect(
      service.editGroup('g1', { ...groupDto, subjectId: 'sub2' }, 'a'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('edita un grupo sin cambiar su identidad', async () => {
    const { service, period, tx } = setup();
    period.status = 'ACTIVE';
    await service.editGroup('g1', groupDto, 'a');
    expect(tx.group.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: groupDto,
    });
  });
  it('rechaza horarios invertidos', async () => {
    const { service } = setup();
    await expect(
      service.schedule(null, { ...scheduleDto, endTime: '08:00' }, 'a'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('detecta cruces de docente y estudiantes en periodos solapados', async () => {
    const { service, tx } = setup();
    tx.scheduleBlock.findFirst.mockResolvedValue({ groupId: 'other' } as never);
    await expect(
      service.schedule(null, scheduleDto, 'a'),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.scheduleBlock.create).not.toHaveBeenCalled();
    const args = tx.scheduleBlock.findFirst.mock.calls[0][0];
    expect(args).toMatchObject({
      where: {
        dayOfWeek: 'MONDAY',
        OR: expect.arrayContaining([
          expect.objectContaining({
            group: expect.objectContaining({
              OR: [
                { teacherId: 't1' },
                {
                  enrollments: {
                    some: { status: 'ACTIVE', studentId: { in: ['s1'] } },
                  },
                },
              ],
            }),
          }),
        ]),
      },
    });
  });
  it('actualizar horario excluye el mismo bloque', async () => {
    const { service, tx } = setup();
    await service.schedule('b1', scheduleDto, 'a');
    expect(tx.scheduleBlock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'b1' } }),
      }),
    );
    expect(tx.scheduleBlock.update).toHaveBeenCalled();
  });
  it('rechaza editar un horario de otro grupo', async () => {
    const { service, tx } = setup();
    tx.scheduleBlock.findUnique.mockResolvedValue({
      id: 'b1',
      groupId: 'other',
    });
    await expect(
      service.schedule('b1', scheduleDto, 'a'),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('no elimina horarios de periodos cerrados', async () => {
    const { service, tx, period } = setup();
    tx.group.findUnique.mockResolvedValue({
      id: 'g1',
      teacherId: 't1',
      subjectId: 'sub1',
      academicPeriodId: 'p1',
      academicPeriod: period,
      scheduleBlocks: [],
    });
    await expect(service.removeSchedule('b1', 'a')).rejects.toMatchObject({
      status: 400,
    });
    expect(tx.scheduleBlock.delete).not.toHaveBeenCalled();
  });
  it('ingresos usan solo aprobados por fecha de verificación en Bolivia', async () => {
    const { service, tx } = setup();
    tx.payment.findMany.mockResolvedValue([
      {
        amount: '0.10',
        method: 'CASH',
        verfiedAt: new Date('2026-11-01T04:00:00Z'),
      },
      {
        amount: '0.20',
        method: 'CASH',
        verfiedAt: new Date('2026-11-02T04:00:00Z'),
      },
    ] as never);
    const report = await service.metrics({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(report.revenue).toBe(0.3);
    expect(report.monthlyRevenue).toEqual([{ month: '2026-11', amount: 0.3 }]);
    expect(tx.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'APPROVED',
          verfiedAt: {
            gte: new Date('2026-11-01T04:00:00Z'),
            lte: new Date('2026-12-01T03:59:59.999Z'),
          },
        },
      }),
    );
  });
  it.each([
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '2026-12-01', to: '2026-11-01' },
    { from: '2024-01-01', to: '2026-11-01' },
  ])('rechaza rango inválido %s', async (query) => {
    const { service } = setup();
    await expect(service.metrics(query)).rejects.toMatchObject({ status: 400 });
  });
});

describe('Permisos y validación de entrada', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  it('Mi cuenta rechaza cambios de rol o estado', async () => {
    await expect(
      pipe.transform(
        {
          firstName: 'Ana',
          lastName: 'Pérez',
          email: 'ana@example.com',
          phone: '',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
        { type: 'body', metatype: ProfileDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rechaza SVG como avatar', async () => {
    await expect(
      pipe.transform(
        { avatarData: 'data:image/svg+xml;base64,PHN2Zz4=' },
        { type: 'body', metatype: AvatarDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rechaza avatar omitido', async () => {
    await expect(
      pipe.transform({}, { type: 'body', metatype: AvatarDto }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('rechaza estados fuera de las operaciones permitidas', async () => {
    await expect(
      pipe.transform(
        { status: 'PENDING_APPROVAL' },
        { type: 'body', metatype: UserStatusDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it.each(['STUDENT', 'TEACHER', 'RECEPCIONIST', 'ADMIN'])(
    'management restringido a ADMIN: %s',
    (role) => {
      const guard = new RolesGuard(new Reflector());
      const context = {
        getHandler: () =>
          Object.getOwnPropertyDescriptor(
            OperationsController.prototype,
            'reopen',
          )!.value,
        getClass: () => OperationsController,
        switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
      } as ExecutionContext;
      if (role === 'ADMIN') expect(guard.canActivate(context)).toBe(true);
      else expect(() => guard.canActivate(context)).toThrow();
    },
  );
  it('rechaza JWT de una versión revocada', async () => {
    const { prisma, user } = setup();
    user.tokenVersion = 2;
    const strategy = new JwtStrategy(
      { getOrThrow: () => 'testing-secret' } as never,
      prisma as never,
    );
    await expect(
      strategy.validate({ sub: 'u1', role: 'STUDENT', tokenVersion: 1 }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      strategy.validate({ sub: 'u1', role: 'STUDENT', tokenVersion: 2 }),
    ).resolves.toMatchObject({ id: 'u1' });
  });
});
