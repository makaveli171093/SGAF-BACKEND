import { Body, Controller, Post, UseGuards, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateGroupDto } from './dto/create-group.dto.js';
import { GroupsService } from './groups.service.js';

@ApiTags('Groups')
@ApiBearerAuth()
@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @ApiOperation({
    summary: 'Crear grupo académico',
    description:
      'Uso: ADMIN. Crea un grupo para una materia dentro de un período académico, asigna un docente y define su capacidad máxima.',
  })
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @ApiOperation({
    summary: 'Consultar mis grupos asignados (teacher)',
    description:
      'Uso: TEACHER autenticado. Devuelve los grupos asignados al docente identificado por el JWT, incluyendo materia, período académico, horarios, capacidad y cantidades de matrículas y tareas.',
  })
  @Get('my-groups')
  @Roles(Role.TEACHER)
  getMyGroups(@Req() req: { user: { id: string } }) {
    return this.groupsService.getMyGroups(req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar grupos académicos',
    description:
      'Uso: Usuario autenticado. Devuelve los grupos registrados con su materia, periodo académico, docente, horarios, capacidad y cantidad de matriculados.',
  })
  findAll() {
    return this.groupsService.findAll();
  }
}
