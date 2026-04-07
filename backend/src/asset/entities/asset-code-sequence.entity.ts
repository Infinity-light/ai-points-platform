import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('asset_code_sequences')
@Index(['tenantId', 'category', 'year'], { unique: true })
export class AssetCodeSequence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column({ length: 50 })
  category!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int', default: 0 })
  lastSeq!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
