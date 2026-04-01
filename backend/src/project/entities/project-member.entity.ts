import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from '../../rbac/entities/role.entity';

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

  @Column({ type: 'uuid', default: '00000000-0000-0000-0000-000000000006' })
  projectRoleId!: string;

  @ManyToOne(() => Role, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'projectRoleId' })
  projectRole!: Role;

  @CreateDateColumn()
  joinedAt!: Date;
}
