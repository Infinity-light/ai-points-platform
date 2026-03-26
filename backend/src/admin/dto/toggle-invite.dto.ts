import { IsBoolean } from 'class-validator';

export class ToggleInviteDto {
  @IsBoolean()
  isActive!: boolean;
}
