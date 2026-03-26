import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('project_members')
@Unique(['projectId', 'userId'])
@Index(['tenantId', 'projectId'])
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  projectId!: string;

  @Column('uuid')
  @Index()
  userId!: string;

  @Column('uuid')
  tenantId!: string;

  @CreateDateColumn()
  joinedAt!: Date;
}
