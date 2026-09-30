import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateAcademicPeriodDto) {
    return this.academicPeriodService.create(dto);
  }
}
