import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('feishu_role_mappings')
@Index(['tenantId', 'feishuRoleName'], { unique: true })
export class FeishuRoleMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ type: 'varchar', length: 100 })
  feishuRoleName!: string;

  @Column('uuid')
  platformRoleId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
