import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { Role, UserStatus } from '../generated/prisma/enums.js';
vi.mock('bcrypt', () => ({
  default: { compare: vi.fn().mockResolvedValue(true) },
}));
function setup(
  status: UserStatus = UserStatus.ACTIVE,
  current: UserStatus = UserStatus.SUSPEND_FOR_DEBT,
  role: Role = Role.STUDENT,
) {
  const user = {
    id: 'u1',
    email: 'test@example.com',
    passwordHash: 'secret-hash',
    firstName: 'Ana',
    lastName: 'Perez',
    role,
    status,
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockImplementation((args: { select?: unknown }) => {
        const { passwordHash: _hash, ...publicUser } = user;
        return Promise.resolve(args.select ? { ...publicUser } : { ...user });
      }),
    },
    studentProfile: { findUnique: vi.fn().mockResolvedValue({ id: 's1' }) },
  };
  const payments = {
    syncStudentDebtStatus: vi
      .fn()
      .mockResolvedValue({
        status: current,
        SUSPEND: current === UserStatus.SUSPEND_FOR_DEBT,
      }),
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('test-token') };
  const config = { getOrThrow: vi.fn().mockReturnValue('test-secret-123456') };
  return {
    prisma,
    payments,
    jwt,
    service: new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      payments as never,
    ),
  };
}
describe('Mora al acceder', () => {
  it.each(['login', 'profile'])(
    'devuelve suspendido actualizado en %s',
    async (operation) => {
      const { service, payments } = setup();
      const result =
        operation === 'login'
          ? await service.login({ email: 'test@example.com', password: 'test' })
          : await service.getProfile('u1');
      expect(result.user.status).toBe(UserStatus.SUSPEND_FOR_DEBT);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(payments.syncStudentDebtStatus).toHaveBeenCalledWith('s1');
    },
  );
  it.each(['login', 'profile'])(
    'devuelve activo tras regularización en %s',
    async (operation) => {
      const { service } = setup(UserStatus.SUSPEND_FOR_DEBT, UserStatus.ACTIVE);
      const result =
        operation === 'login'
          ? await service.login({ email: 'test@example.com', password: 'test' })
          : await service.getProfile('u1');
      expect(result.user.status).toBe(UserStatus.ACTIVE);
    },
  );
  it.each([UserStatus.INACTIVE, UserStatus.PENDING_APPROVAL])(
    'no sincroniza ni permite acceso a %s',
    async (status) => {
      const { service, payments, jwt } = setup(status);
      await expect(
        service.login({ email: 'test@example.com', password: 'test' }),
      ).rejects.toThrow();
      await expect(service.getProfile('u1')).rejects.toThrow();
      expect(payments.syncStudentDebtStatus).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    },
  );
  it.each([Role.ADMIN, Role.TEACHER, Role.RECEPCIONIST])(
    'no calcula mora para %s',
    async (role) => {
      const { service, payments, prisma } = setup(
        UserStatus.ACTIVE,
        UserStatus.ACTIVE,
        role,
      );
      await service.login({ email: 'test@example.com', password: 'test' });
      await service.getProfile('u1');
      expect(prisma.studentProfile.findUnique).not.toHaveBeenCalled();
      expect(payments.syncStudentDebtStatus).not.toHaveBeenCalled();
    },
  );
  it('no sincroniza al recibir contraseña incorrecta', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
    const { service, payments } = setup();
    await expect(
      service.login({ email: 'test@example.com', password: 'wrong' }),
    ).rejects.toThrow('Credenciales');
    expect(payments.syncStudentDebtStatus).not.toHaveBeenCalled();
  });
  it('no emite token si la sincronización falla', async () => {
    const { service, payments, jwt } = setup();
    payments.syncStudentDebtStatus.mockRejectedValueOnce(
      new Error('DB unavailable'),
    );
    await expect(
      service.login({ email: 'test@example.com', password: 'test' }),
    ).rejects.toThrow();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
  it('no emite token si el estado cambia a inactivo durante la consulta', async () => {
    const { service, jwt } = setup(UserStatus.ACTIVE, UserStatus.INACTIVE);
    await expect(
      service.login({ email: 'test@example.com', password: 'test' }),
    ).rejects.toThrow();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
