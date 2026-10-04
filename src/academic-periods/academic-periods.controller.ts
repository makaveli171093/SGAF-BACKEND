import { Body, Controller, Post, UseGuards, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateAcademicPeriodDto } from './dto/create-academic-period.dto.js';
import { AcademicPeriodsService } from './academic-periods.service.js';

@ApiTags('Academic Periods')
@ApiBearerAuth()
@Controller('academic-periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicPeriodsController {
  constructor(private readonly academicPeriodService: AcademicPeriodsService) {}

  @ApiOperation({
    summary: 'Crear período académico',
    description:
      'Uso: ADMIN. Crea un período académico indicando fechas, máximo de créditos y estado. Las fechas deben ser válidas y no debe solaparse con otro período.',
  })
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateAcademicPeriodDto) {
    return this.academicPeriodService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar periodos academicos',
    description:
      'Uso: Usuario autenticado. Devuelve los periodos academicos registrados, incluyendo fechas, limite de creditos y estado.',
  })
  findAll() {
    return this.academicPeriodService.findAll();
  }
}
