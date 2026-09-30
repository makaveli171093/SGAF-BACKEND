import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class CreateAcademicPeriodDto {
  @ApiProperty({
    example: 'Gestion 2026 - Primer Semestre',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '2026-02-02',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2026-06-30',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    example: 30,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  maxCredits: number;
}
