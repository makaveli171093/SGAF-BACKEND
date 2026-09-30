import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateSubjectDto } from './dto/create-subjects.dto.js';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubjectDto) {
    const existingSubject = await this.prisma.subject.findUnique({
      where: {
        code: dto.code,
      },
    });

    if (existingSubject) {
      throw new ConflictException('Ya exixste una materia con ese codigo');
    }

    const subject = await this.prisma.subject.create({
      data: {
        code: dto.code,
        name: dto.name,
        credits: dto.credits,
        enrollmentFee: dto.enrollmentFee,
        monthlyFee: dto.monthlyFee,
      },
    });

    return {
      message: 'Materia creada correctamente',
      subject,
    };
  }
}
