import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ExecutionContext,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AcademicPeriodsService } from './academic-periods.service.js';
import { AcademicPeriodsController } from './academic-periods.controller.js';
import { UpdateAcademicPeriodStatusDto } from './dto/update-academic-period-status.dto.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

const id = '550e8400-e29b-41d4-a716-446655440000';

function setup(status = 'PLANNED') {
  const period = {
    id,
    name: 'Gestión 2026',
    startDate: new Date('2026-11-01T04:00:00Z'),
    endDate: new Date('2026-12-01T03:59:00Z'),
    maxCredits: 30,
    status,
  };
  const prisma = {
    academicPeriod: {
      findUnique: vi.fn().mockResolvedValue(period),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    period,
    prisma,
    service: new AcademicPeriodsService(prisma as never),
  };
}

describe('Estado de períodos académicos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('activa un período vigente y conserva su configuración', async () => {
    const { service, prisma, period } = setup();
    const result = await service.updateStatus(id, { status: 'ACTIVE' });
    expect(result.academicPeriod).toEqual({ ...period, status: 'ACTIVE' });
    expect(prisma.academicPeriod.updateMany).toHaveBeenCalledWith({
      where: { id, status: 'PLANNED' },
      data: { status: 'ACTIVE' },
    });
  });

  it.each(['PLANNED', 'ACTIVE'])('cierra un período %s', async (status) => {
    const { service } = setup(status);
    expect(
      (await service.updateStatus(id, { status: 'CLOSED' })).academicPeriod
        .status,
    ).toBe('CLOSED');
  });

  it.each(['ACTIVE', 'CLOSED'] as const)(
    'repetir %s no escribe datos',
    async (status) => {
      const { service, prisma } = setup(status);
      await service.updateStatus(id, { status });
      expect(prisma.academicPeriod.updateMany).not.toHaveBeenCalled();
    },
  );

  it('no reabre un período cerrado', async () => {
    const { service, prisma } = setup('CLOSED');
    await expect(
      service.updateStatus(id, { status: 'ACTIVE' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.academicPeriod.updateMany).not.toHaveBeenCalled();
  });

  it.each(['2026-11-01T03:59:59.999Z', '2026-12-01T03:59:00.001Z'])(
    'rechaza activación fuera de vigencia: %s',
    async (now) => {
      vi.setSystemTime(new Date(now));
      const { service, prisma } = setup();
      await expect(
        service.updateStatus(id, { status: 'ACTIVE' }),
      ).rejects.toMatchObject({ status: 400 });
      expect(prisma.academicPeriod.updateMany).not.toHaveBeenCalled();
    },
  );

  it.each(['2026-11-01T04:00:00Z', '2026-12-01T03:59:00Z'])(
    'admite los límites de vigencia: %s',
    async (now) => {
      vi.setSystemTime(new Date(now));
      const { service } = setup();
      expect(
        (await service.updateStatus(id, { status: 'ACTIVE' })).academicPeriod
          .status,
      ).toBe('ACTIVE');
    },
  );

  it('devuelve 404 si el período no existe', async () => {
    const { service, prisma } = setup();
    prisma.academicPeriod.findUnique.mockResolvedValue(null);
    await expect(
      service.updateStatus(id, { status: 'ACTIVE' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.academicPeriod.updateMany).not.toHaveBeenCalled();
  });

  it('no sobrescribe un cambio concurrente', async () => {
    const { service, prisma } = setup();
    prisma.academicPeriod.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.updateStatus(id, { status: 'ACTIVE' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('Contrato y permisos del cambio de estado', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const metadata = {
    type: 'body' as const,
    metatype: UpdateAcademicPeriodStatusDto,
  };

  it.each([
    { status: 'PLANNED' },
    { status: 'INVALID' },
    {},
    { status: null },
    { status: 'ACTIVE', maxCredits: 99 },
  ])('rechaza un cuerpo inválido: %j', async (body) => {
    await expect(pipe.transform(body, metadata)).rejects.toMatchObject({
      status: 400,
    });
  });

  it.each(['ACTIVE', 'CLOSED'])('acepta el estado %s', async (status) => {
    expect(await pipe.transform({ status }, metadata)).toMatchObject({
      status,
    });
  });

  it('rechaza identificadores que no sean UUID', async () => {
    await expect(
      new ParseUUIDPipe().transform('invalid', { type: 'param' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it.each(['ADMIN', 'TEACHER', 'STUDENT', 'RECEPCIONIST', undefined])(
    'restringe la operación por rol: %s',
    (role) => {
      const context = {
        getHandler: () =>
          Object.getOwnPropertyDescriptor(
            AcademicPeriodsController.prototype,
            'updateStatus',
          )!.value as () => void,
        getClass: () => AcademicPeriodsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: role ? { role } : undefined }),
        }),
      } as unknown as ExecutionContext;
      const guard = new RolesGuard(new Reflector());
      if (role === 'ADMIN') expect(guard.canActivate(context)).toBe(true);
      else expect(() => guard.canActivate(context)).toThrow();
    },
  );
});
