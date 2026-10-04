import { Body, Controller, Post, UseGuards, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateSubjectDto } from './dto/create-subjects.dto.js';
import { SubjectsService } from './subjects.service.js';

@ApiTags('Subjects')
@ApiBearerAuth()
@Controller('subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectsController {
  constructor(private readonly subjectService: SubjectsService) {}

  @ApiOperation({
    summary: 'Crear materia',
    description:
      'Uso: ADMIN. Registra una materia en el catálogo académico con código único, créditos, costo de matrícula, mensualidad y estado activo.',
  })
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateSubjectDto) {
    return this.subjectService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar materias',
    description:
      'Uso: Usuario autenticado. Devuelve el catálogo de materias registradas, incluyendo código, créditos, costos y estado.',
  })
  findAll() {
    return this.subjectService.findAll();
  }
}
