import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateAcademicPeriodDto } from './dto/create-academic-period.dto.js';

@Injectable()
export class AcademicPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAcademicPeriodDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de finalizacion',
      );
    }

    const academicPeriod = await this.prisma.academicPeriod.create({
      data: {
        name: dto.name,
        startDate,
        endDate,
        maxCredits: dto.maxCredits,
        status: 'PLANNED',
      },
    });

    return {
      message: 'Periodo academico creado correctamente',
      academicPeriod,
    };
  }
}
