import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';

export type RoleScope = 'tenant' | 'project';

@Entity('roles')
@Index(['tenantId'])
@Index(['scope'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20 })
  scope!: RoleScope;

  @Column({ default: false })
  isSystem!: boolean;

  @OneToMany(() => RolePermission, (rp) => rp.role, { eager: false })
  permissions!: RolePermission[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
