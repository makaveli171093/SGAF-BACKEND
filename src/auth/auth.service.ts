import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { RegisterStudentDto } from './dto/register-student.dto.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { string } from 'joi';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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

  private generateEnrollmentCode(): string {
    const year = new Date().getFullYear();
    const random = crypto.randomUUID().split('-')[0].toUpperCase();

    return `EST-${year}-${random}`;
  }
}
