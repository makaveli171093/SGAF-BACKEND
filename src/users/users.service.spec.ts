import { describe, expect, it, vi } from 'vitest';

import { UsersService } from './users.service.js';
import { containsSensitiveField } from '../common/testing/assert-no-sensitive-fields.js';
import {
  ObligationStatus,
  ObligationType,
  Role,
  UserStatus,
} from '../generated/prisma/enums.js';

describe('UsersService', () => {
  it('approveStudentApplicant no expone passwordHash', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'postulante@sgaf.com',
          passwordHash: 'HASH_QUE_NO_DEBE_SALIR',
          firstName: 'Luis',
          lastName: 'Postulante',
          role: Role.STUDENT,
          status: UserStatus.PENDING_APPROVAL,
          stundentProfile: {
            financialObligations: [
              {
                id: 'obligation-1',
                type: ObligationType.ENROLLMENT,
                status: ObligationStatus.PAID,
              },
            ],
          },
        }),

        update: vi.fn().mockResolvedValue({
          id: 'user-1',
          email: 'postulante@sgaf.com',
          firstName: 'Luis',
          lastName: 'Postulante',
          phone: null,
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
        }),
      },
    };

    const service = new UsersService(prisma as never);

    const result = await service.approveStudentApplicant('user-1');

    expect(containsSensitiveField(result)).toBe(false);

    expect(result.user.status).toBe(UserStatus.ACTIVE);
  });
});

describe('Creación de personal', () => {
  it('devuelve identidad pública y perfil', async () => {
    const user = {
      id: 'user-1',
      email: 'ana@example.com',
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
    };
    const tx = {
      user: { create: vi.fn().mockResolvedValue(user) },
      teacherProfile: {
        create: vi
          .fn()
          .mockResolvedValue({
            id: 'teacher-1',
            specialty: 'Matemáticas',
            hireDate: new Date(),
          }),
      },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi
        .fn()
        .mockImplementation((fn: (value: typeof tx) => unknown) => fn(tx)),
    };
    const result = await new UsersService(prisma as never).createStaff({
      firstName: 'Ana',
      lastName: 'Perez',
      email: 'ana@example.com',
      password: 'Test-password-123',
      ci: '1234567',
      role: Role.TEACHER,
      specialty: 'Matemáticas',
      hireDate: '2026-01-01',
    });
    expect(result.user).toMatchObject({
      id: 'user-1',
      email: 'ana@example.com',
      teacherProfile: { id: 'teacher-1' },
    });
    expect(result.user).not.toHaveProperty('select');
    expect(containsSensitiveField(result)).toBe(false);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ passwordHash: true }),
      }),
    );
  });
});
