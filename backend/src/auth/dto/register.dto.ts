import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @MaxLength(64)
  password!: string;

  @IsString()
  @IsNotEmpty({ message: '请输入姓名' })
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteCode?: string;

  @IsString()
  @IsNotEmpty()
  tenantSlug!: string; // 通过 slug 识别租户（注册时指定加入哪个租户）
}
