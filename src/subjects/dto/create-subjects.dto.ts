import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({
    example: 'MAT-101',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'Matemáticas I',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 4,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  credits: number;

  @ApiProperty({
    example: 200,
  })
  @IsNumber()
  @Min(0)
  enrollmentFee: number;

  @ApiProperty({
    example: 180,
  })
  @IsNumber()
  @Min(0)
  monthlyFee: number;
}
