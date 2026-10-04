import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
  Get,
} from '@nestjs/common';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from '../auth/decorators/roles.decorators.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateStaffUserDto } from './dto/create-staff-user.dto.js';
import { UsersService } from './users.service.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Crear usuario interno',
    description:
      'Uso: ADMIN. Permite crear usuarios internos con rol ADMIN, RECEPCIONIST o TEACHER. Los docentes reciben además su TeacherProfile. No se usa para registrar estudiantes.',
  })
  @Post('staff')
  @Roles(Role.ADMIN)
  createStaff(@Body() dto: CreateStaffUserDto) {
    return this.usersService.createStaff(dto);
  }

  @ApiOperation({
    summary: 'Aprobar postulante',
    description:
      'Uso: RECEPTIONIST. El usuario debe ser STUDENT, estar PENDING_APPROVAL y tener su obligación de matrícula en estado PAID. Si cumple, cambia a ACTIVE y ya puede iniciar sesión normalmente.',
  })
  @Patch('applicants/:id/approve')
  @Roles(Role.RECEPCIONIST)
  approveStudentApplicant(@Param('id') userId: string) {
    return this.usersService.approveStudentApplicant(userId);
  }

  @ApiOperation({
    summary: 'Listar usuarios del sistema',
    description:
      'Uso:ADMIN. Devuelve los usuarios registrados con su rol, estado y datos básicos. No expone información sensible como contraseñas.',
  })
  @Get()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }
}
