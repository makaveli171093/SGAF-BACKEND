import { describe, it, expect, vi } from 'vitest';
import { EnrollmentsService } from './enrollments.service.js';
import { SubmissionsService } from '../submissions/submissions.service.js';

describe.each(['matrícula', 'entrega'])(
  'Estado actualizado para %s',
  (operation) => {
    function setup(status: string, suspend: boolean) {
      const prisma = {
        studentProfile: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: 'student-1',
              user: { status: 'SUSPEND_FOR_DEBT' },
            }),
        },
        group: { findUnique: vi.fn().mockResolvedValue(null) },
        assignment: { findUnique: vi.fn().mockResolvedValue(null) },
      };
      const payments = {
        syncStudentDebtStatus: vi
          .fn()
          .mockResolvedValue({ status, SUSPEND: suspend }),
      };
      const create = () =>
        operation === 'matrícula'
          ? new EnrollmentsService(prisma as never, payments as never).create(
              'user-1',
              { groupId: 'group-1' },
            )
          : new SubmissionsService(prisma as never, payments as never).create(
              'user-1',
              { assignmentId: 'assignment-1', textContent: 'Respuesta' },
            );
      return { prisma, create };
    }
    it('permite seguir las validaciones después de regularizar deuda', async () => {
      const { create, prisma } = setup('ACTIVE', false);
      await expect(create()).rejects.toThrow(
        operation === 'matrícula'
          ? 'grupo solicitado no existe'
          : 'tarea no existe',
      );
      expect(
        operation === 'matrícula'
          ? prisma.group.findUnique
          : prisma.assignment.findUnique,
      ).toHaveBeenCalled();
    });
    it.each([
      ['INACTIVE', false],
      ['PENDING_APPROVAL', false],
      ['SUSPEND_FOR_DEBT', true],
    ])('bloquea %s antes de operar', async (status, suspend) => {
      const { create, prisma } = setup(status as string, suspend as boolean);
      await expect(create()).rejects.toThrow();
      expect(prisma.group.findUnique).not.toHaveBeenCalled();
      expect(prisma.assignment.findUnique).not.toHaveBeenCalled();
    });
  },
);
