import { IsUUID, IsNotEmpty } from 'class-validator';

export class AddMemberDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;
}
