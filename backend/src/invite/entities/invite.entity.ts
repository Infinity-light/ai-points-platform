import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('invites')
@Index(['tenantId', 'code'], { unique: true })
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 64, unique: false })
  @Index()
  code!: string; // 邀请码字符串

  @Column({ default: 1 })
  maxUses!: number; // 最大使用次数（默认1次）

  @Column({ default: 0 })
  usedCount!: number; // 已使用次数

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null; // 过期时间（null = 永不过期）

  @Column({ default: true })
  isActive!: boolean; // 是否激活（可手动停用）

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null; // 备注（如：给某部门的邀请码）

  @Column('uuid')
  createdBy!: string; // 创建者 userId

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
