import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum SkillStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

@Entity('skills')
@Index(['tenantId', 'projectId'])
@Unique(['tenantId', 'projectId', 'name'])
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  projectId!: string;

  @Column()
  name!: string;

  @Column('text')
  description!: string;

  @Column({ nullable: true })
  category!: string | null;

  @Column({ default: 1 })
  version!: number;

  @Column('uuid')
  authorId!: string;

  @Column('text')
  content!: string;

  @Column({ nullable: true })
  repoUrl!: string | null;

  @Column('uuid', { nullable: true })
  latestSubmissionId!: string | null;

  @Column({
    type: 'enum',
    enum: SkillStatus,
    default: SkillStatus.ACTIVE,
  })
  status!: SkillStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
