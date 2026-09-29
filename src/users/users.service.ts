import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateStaffUserDto } from './dto/create-staff-user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createStaff(dto: CreateStaffUserDto) {
    const allowedRoles: Role[] = [Role.ADMIN, Role.RECEPCIONIST, Role.TEACHER];

    if (!allowedRoles.includes(dto.role)) {
      throw new BadRequestException(
        'Este endpoint solo permite crear personal admitrativo, recepcion o docentes',
      );
    }

    if (dto.role === Role.TEACHER && (!dto.specialty || !dto.hireDate)) {
      throw new BadRequestException(
        'Los docentes requieren Especialidad y Fecha de contratacion',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { ci: dto.ci }],
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario registrado con el Email y/o CI',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          ci: dto.ci,
          phone: dto.phone,
          role: dto.role,
          status: 'ACTIVE',
        },
      });

      let teacherProfile = null;

      if (dto.role === Role.TEACHER) {
        teacherProfile = await tx.teacherProfile.create({
          data: {
            userId: user.id,
            specialty: dto.specialty!,
            hireDate: new Date(dto.hireDate!),
          },
        });
      }

      return {
        user,
        teacherProfile,
      };
    });

    return {
      message: 'Usuario creado exitosamente',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        status: result.user.status,
        teacherProfile: result.teacherProfile
          ? {
              id: result.teacherProfile.id,
              specialty: result.teacherProfile.specialty,
              hireDate: result.teacherProfile.hireDate,
            }
          : null,
      },
    };
  }
}
