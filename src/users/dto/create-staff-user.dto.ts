import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '../../generated/prisma/enums.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStaffUserDto {
  @ApiProperty({
    example: 'carlos.mamani@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Clave123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'carlos',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'mamani',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    example: '12345678',
  })
  @IsString()
  @Length(5, 20)
  ci: string;

  @ApiPropertyOptional({
    example: '71234567',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    enum: Role,
    example: Role.TEACHER,
  })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({
    example: 'matematicas',
  })
  @ValidateIf((dto: CreateStaffUserDto) => dto.role === Role.TEACHER)
  @IsString()
  @IsNotEmpty()
  specialty?: string;

  @ApiPropertyOptional({
    example: '2026-02-01T00:00:00.000Z',
  })
  @ValidateIf((dto: CreateStaffUserDto) => dto.role === Role.TEACHER)
  @IsDateString()
  hireDate?: string;
}
