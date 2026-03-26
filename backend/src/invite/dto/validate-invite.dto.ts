import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateInviteDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  tenantSlug!: string;
}
