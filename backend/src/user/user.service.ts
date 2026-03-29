import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './enums/role.enum';

const SALT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { password, tenantId, email, ...rest } = createUserDto;

    // 检查同租户内邮箱是否重复
    const existing = await this.userRepository.findOne({
      where: { tenantId, email },
    });
    if (existing) {
      throw new ConflictException('该邮箱在此组织中已被注册');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 该租户的第一个注册用户自动成为超级管理员
    let assignedRole = rest.role ?? Role.EMPLOYEE;
    if (!rest.role) {
      const tenantUserCount = await this.userRepository.count({ where: { tenantId } });
      if (tenantUserCount === 0) {
        assignedRole = Role.SUPER_ADMIN;
      }
    }

    const user = this.userRepository.create({
      tenantId,
      email,
      passwordHash,
      name: rest.name,
      phone: rest.phone ?? null,
      role: assignedRole,
      inviteCodeUsed: rest.inviteCode ?? null,
      isEmailVerified: false,
    });

    return this.userRepository.save(user);
  }

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.tenantId = :tenantId', { tenantId })
      .andWhere('user.email = :email', { email })
      .getOne();
  }

  async findById(id: string, tenantId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId },
    });
    if (!user) {
      throw new NotFoundException(`用户 ${id} 不存在`);
    }
    return user;
  }

  async findAllByTenant(tenantId: string): Promise<User[]> {
    return this.userRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id, tenantId);
    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  async updateEmailVerification(
    id: string,
    code: string,
    expiry: Date,
  ): Promise<void> {
    await this.userRepository.update(id, {
      emailVerificationCode: code,
      emailVerificationExpiry: expiry,
    });
  }

  async verifyEmail(id: string): Promise<void> {
    await this.userRepository.update(id, {
      isEmailVerified: true,
      emailVerificationCode: null,
      emailVerificationExpiry: null,
    });
  }

  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    const hash = refreshToken ? await bcrypt.hash(refreshToken, SALT_ROUNDS) : null;
    await this.userRepository.update(id, { refreshToken: hash });
  }

  async validatePassword(user: User, plainPassword: string): Promise<boolean> {
    // 需要重新获取含 passwordHash 的用户
    const userWithHash = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: user.id })
      .getOne();

    if (!userWithHash?.passwordHash) return false;
    return bcrypt.compare(plainPassword, userWithHash.passwordHash);
  }

  async findByIdWithRefreshToken(id: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.refreshToken')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByIdWithVerificationCode(id: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationCode')
      .addSelect('user.emailVerificationExpiry')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByIdGlobal(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }
}
