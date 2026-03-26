import { IsEnum, IsNotEmpty } from 'class-validator';
import { TaskStatus } from '../enums/task-status.enum';

export class TransitionTaskDto {
  @IsEnum(TaskStatus)
  @IsNotEmpty()
  status!: TaskStatus;
}
