import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('invite_usages')
export class InviteUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  inviteId!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  usedBy!: string; // userId

  @CreateDateColumn()
  usedAt!: Date;
}
