import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterStudentDto } from './dto/register-student.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { Role } from '../generated/prisma/enums.js';
import { Roles } from './decorators/roles.decorators.js';
import { RolesGuard } from './guards/roles.guard.js';
import { ApiTags } from '@nestjs/swagger';
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getProfile(@Req() req: any) {
    return {
      user: req.user,
    };
  }

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

  @Post('register')
  register(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
