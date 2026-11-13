import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateAcademicPeriodDto } from './dto/create-academic-period.dto.js';
import { UpdateAcademicPeriodStatusDto } from './dto/update-academic-period-status.dto.js';

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

  async updateStatus(id: string, dto: UpdateAcademicPeriodStatusDto) {
    const period = await this.prisma.academicPeriod.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        maxCredits: true,
        status: true,
      },
    });

    if (!period) {
      throw new NotFoundException('El período académico no existe');
    }

    if (period.status === dto.status) {
      return {
        message: 'El período académico ya tiene el estado solicitado',
        academicPeriod: period,
      };
    }

    if (period.status === 'CLOSED') {
      throw new ConflictException('No se puede reabrir un período cerrado');
    }

    if (dto.status === 'ACTIVE') {
      const now = new Date();
      if (now < period.startDate || now > period.endDate) {
        throw new BadRequestException(
          'Solo se puede activar un período dentro de sus fechas de vigencia',
        );
      }
    }

    // Compare the previous state to avoid overwriting a concurrent closure.
    const result = await this.prisma.academicPeriod.updateMany({
      where: { id, status: period.status },
      data: { status: dto.status },
    });

    if (result.count !== 1) {
      throw new ConflictException(
        'El período cambió durante la operación. Actualiza la lista e inténtalo de nuevo',
      );
    }

    return {
      message:
        dto.status === 'ACTIVE'
          ? 'Período académico activado correctamente'
          : 'Período académico cerrado correctamente',
      academicPeriod: { ...period, status: dto.status },
    };
  }

  async findAll() {
    const periods = await this.prisma.academicPeriod.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        maxCredits: true,
        status: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    return {
      message: 'Periodos academicos obtenidos correctamente',
      periods,
    };
  }
}
