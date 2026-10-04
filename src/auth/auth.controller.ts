import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterStudentDto } from './dto/register-student.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from './decorators/roles.decorators.js';
import { RolesGuard } from './guards/roles.guard.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Consultar usuario autenticado',
    description:
      'Uso: usuario autenticado. Devuelve los datos del usuario identificado por el JWT. Sirve para comprobar sesión, rol y estado actual.',
  })
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getProfile(@Req() req: any) {
    return {
      user: req.user,
    };
  }

  @ApiOperation({
    summary: 'Validar acceso administrativo',
    description:
      'Uso: ADMIN. Endpoint de prueba para verificar que el JWT y el control de roles funcionan correctamente.',
  })
  @Get('admin-test')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminTest(@Req() req: any) {
    return {
      message: 'Acceso administrativo permitido',
      user: req.user,
    };
  }

  @ApiOperation({
    summary: 'Registrar nuevo estudiante',
    description:
      'Uso: público. Crea un usuario STUDENT en estado PENDING_APPROVAL, su StudentProfile y una obligación financiera inicial de matrícula. Devuelve también el enrollmentCode y los datos de la obligación para continuar con el pago.',
  })
  @Post('register')
  register(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto);
  }

  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Uso: usuarios habilitados. Valida correo y contraseña y devuelve un JWT. Los usuarios PENDING_APPROVAL no pueden iniciar sesión hasta ser aprobados por RECEPTIONIST.',
  })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
