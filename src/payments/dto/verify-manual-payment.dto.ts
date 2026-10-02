import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '../../generated/prisma/enums.js';

export class VerifyManualPaymentDto {
  @ApiProperty({
    enum: [PaymentStatus.APPROVED, PaymentStatus.REJECTED],
    example: PaymentStatus.APPROVED,
  })
  @IsIn([PaymentStatus.APPROVED, PaymentStatus.REJECTED])
  status: PaymentStatus;

  @ApiPropertyOptional({
    example: 'Transferencia verificada correctamente',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
