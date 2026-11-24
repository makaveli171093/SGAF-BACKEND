import { describe, it, expect, vi } from 'vitest';
import { serializable } from './serializable.js';
import { ConflictException } from '@nestjs/common';

describe('Conflictos transaccionales', () => {
  it.each([
    { code: 'P2034' },
    { code: 'P2002' },
    new Error('TransactionWriteConflict', { cause: { originalCode: '40001' } }),
    new Error('Deadlock', { cause: { originalCode: '40P01' } }),
  ])('convierte conflictos en 409 sin repetir operaciones', async (error) => {
    const prisma = { $transaction: vi.fn().mockRejectedValue(error) };
    await expect(
      serializable(prisma as never, async () => null),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it('conserva errores que no son de concurrencia', async () => {
    const error = new Error('Database unavailable');
    await expect(
      serializable(
        { $transaction: vi.fn().mockRejectedValue(error) } as never,
        async () => null,
      ),
    ).rejects.toBe(error);
  });
});
