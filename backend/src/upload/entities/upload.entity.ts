import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('uploads')
export class Upload {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  uploadedBy!: string; // userId

  @Column({ length: 500 })
  originalName!: string;

  @Column({ length: 200 })
  mimeType!: string;

  @Column()
  size!: number; // bytes

  @Column({ length: 1000 })
  storagePath!: string; // relative path under uploads dir

  @Column({ length: 1000 })
  publicUrl!: string; // URL for accessing the file

  @CreateDateColumn()
  createdAt!: Date;
}
