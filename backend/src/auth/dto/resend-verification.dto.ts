import { IsString, IsNotEmpty } from 'class-validator';

export class ResendVerificationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
