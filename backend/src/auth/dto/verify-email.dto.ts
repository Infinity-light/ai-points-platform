import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @Length(6, 6, { message: '验证码为6位' })
  code!: string;
}
