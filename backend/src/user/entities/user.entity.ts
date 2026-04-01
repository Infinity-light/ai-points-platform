import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { UserRole } from '../../rbac/entities/user-role.entity';

@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 255 })
  email!: string;

  @Column({ type: 'varchar', select: false })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ length: 100 })
  name!: string;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ type: 'varchar', nullable: true, select: false })
  emailVerificationCode!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpiry!: Date | null;

  @Column({ type: 'varchar', nullable: true, select: false })
  refreshToken!: string | null;

  @Column({ type: 'varchar', nullable: true })
  inviteCodeUsed!: string | null;

  @OneToOne(() => UserRole, { eager: false, nullable: true })
  @JoinColumn({ name: 'id', referencedColumnName: 'userId' })
  userRole!: UserRole | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
