import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches, IsNotEmpty } from 'class-validator';

export class RegisterOrgDto {
  // Tenant info
  @IsString()
  @IsNotEmpty({ message: '请输入组织名称' })
  @MaxLength(100)
  orgName!: string;

  @IsString()
  @IsNotEmpty({ message: '请输入组织标识' })
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: '组织标识只能包含小写字母、数字和连字符',
  })
  orgSlug!: string;

  // User info
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
}
