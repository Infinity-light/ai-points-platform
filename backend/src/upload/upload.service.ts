import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Upload } from './entities/upload.entity';
import * as path from 'path';
import * as fs from 'fs';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/markdown',
  'application/zip',
  'video/mp4', 'video/quicktime',
];

@Injectable()
export class UploadService {
  private readonly uploadDir: string;
  private readonly maxFileSizeMB: number;

  constructor(
    @InjectRepository(Upload)
    private readonly uploadRepository: Repository<Upload>,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR') ?? './uploads';
    this.maxFileSizeMB = Number(this.configService.get<string>('MAX_FILE_SIZE_MB') ?? '10');
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(
    file: Express.Multer.File,
    tenantId: string,
    uploadedBy: string,
  ): Promise<Upload> {
    // Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的文件类型: ${file.mimetype}`);
    }

    // Validate file size
    const maxBytes = this.maxFileSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`文件大小不能超过 ${this.maxFileSizeMB}MB`);
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const tenantDir = path.join(this.uploadDir, tenantId);
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    const storagePath = path.join(tenantDir, uniqueName);

    // Write file
    try {
      fs.writeFileSync(storagePath, file.buffer);
    } catch {
      throw new InternalServerErrorException('文件保存失败');
    }

    const publicUrl = `/uploads/${tenantId}/${uniqueName}`;

    const upload = this.uploadRepository.create({
      tenantId,
      uploadedBy,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storagePath,
      publicUrl,
    });

    return this.uploadRepository.save(upload);
  }

  async findById(id: string, tenantId: string): Promise<Upload | null> {
    return this.uploadRepository.findOne({ where: { id, tenantId } });
  }
}
