import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateApplicantOnlinePaymentDto {
  @ApiProperty({
    description: 'ID de la obligación de matrícula',
    example: '1669eaaa-7e5d-4ca7-abfb-7027e8c66e51',
  })
  @IsUUID()
  obligationId: string;

  @ApiProperty({
    description: 'Código de matrícula generado al registrarse',
    example: 'STU-2026-0001',
  })
  @IsString()
  enrollmentCode: string;
}
