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
