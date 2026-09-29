import {
  ConflictException,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { RegisterStudentDto } from './dto/register-student.dto.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async registerStudent(dto: RegisterStudentDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { ci: dto.ci }],
      },
    });
    if (existingUser) {
      throw new ConflictException(
        'Ya existe un usuario cregistrado con ese Email o CI',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const enrollmentCode = this.generateEnrollmentCode();
    const enrollmentAmount = 200;

    const student = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          ci: dto.ci,
          phone: dto.phone,
          role: 'STUDENT',
          status: 'PENDING_APPROVAL',
        },
      });

      const studentProfile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          enrollmentCode,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
          guardianCi: dto.guardianCi,
        },
      });

      await tx.financialObligation.create({
        data: {
          studentId: studentProfile.id,
          type: 'ENROLLMENT',
          description: 'Matrícula inicial',
          amount: enrollmentAmount,
          dueDate: new Date(),
          status: 'PENDING',
        },
      });
      return {
        user,
        studentProfile,
      };
    });

    return {
      message: 'Postulante registrado correctamente',
      student: {
        id: student.user.id,
        email: student.user.email,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        role: student.user.role,
        status: student.user.status,
        enrollmentCode: student.studentProfile.enrollmentCode,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (user.status === 'PENDING_APPROVAL') {
      throw new ForbiddenException('La cuenta esta pendiente de aprobacion');
    }
    if (user.status === 'SUSPEND_FOR_DEBT') {
      throw new ForbiddenException(
        'La cuenta esta suspendida por obligaciones financieras',
      );
    }
    if (user.status === 'INACTIVE') {
      throw new ForbiddenException('La cuenta esta inactiva');
    }
    const payload = {
      sub: user.id,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '1d',
    });

    return {
      message: 'Inicio de sesion exitoso',
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
      },
    };
  }

  private generateEnrollmentCode(): string {
    const year = new Date().getFullYear();
    const random = crypto.randomUUID().split('-')[0].toUpperCase();

    return `EST-${year}-${random}`;
  }
}
