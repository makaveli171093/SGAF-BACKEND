import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

/** Never retry externally visible side effects automatically. */
export async function serializable<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(operation, {
      isolationLevel: 'Serializable',
    });
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;
    // Prisma's pg adapter can expose commit-time conflicts directly instead
    // of wrapping them in P2034. Both paths must produce the same HTTP 409.
    const cause = error instanceof Error ? error.cause : undefined;
    const sqlState =
      typeof cause === 'object' && cause !== null && 'originalCode' in cause
        ? cause.originalCode
        : undefined;
    if (
      code === 'P2034' ||
      code === 'P2002' ||
      sqlState === '40001' ||
      sqlState === '40P01'
    ) {
      throw new ConflictException(
        'La operación coincide con otra solicitud o ya fue registrada. Actualiza los datos antes de repetirla.',
      );
    }
    throw error;
  }
}
