import { describe, it, expect, vi } from 'vitest';
import { SubmissionsService } from './submissions.service.js';

describe('Consulta de entregas del docente', () => {
  function setup(owner = 'teacher-1') {
    const prisma = {
      assignment: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ group: { teacher: { userId: owner } } }),
      },
      submission: { findMany: vi.fn().mockResolvedValue([]) },
    };
    return {
      prisma,
      service: new SubmissionsService(prisma as never, {} as never),
    };
  }
  it('rechaza consultar entregas de otro docente', async () => {
    const { service, prisma } = setup('otro');
    await expect(
      service.findByAssignment('teacher-1', 'assignment-1'),
    ).rejects.toThrow('autorizado');
    expect(prisma.submission.findMany).not.toHaveBeenCalled();
  });
  it('devuelve lista vacía para una tarea propia sin entregas', async () => {
    const { service } = setup();
    expect(
      (await service.findByAssignment('teacher-1', 'assignment-1')).submissions,
    ).toEqual([]);
  });
  it('informa una tarea inexistente', async () => {
    const { service, prisma } = setup();
    prisma.assignment.findUnique.mockResolvedValue(null as never);
    await expect(
      service.findByAssignment('teacher-1', 'missing'),
    ).rejects.toThrow('no existe');
  });
});
