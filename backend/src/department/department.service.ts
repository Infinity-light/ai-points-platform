import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Department } from './entities/department.entity';
import { User } from '../user/entities/user.entity';

export interface DeptTreeNode extends Department {
  children: DeptTreeNode[];
}

export interface UpsertDeptData {
  feishuDeptId: string;
  name: string;
  parentFeishuDeptId?: string | null;
  sortOrder?: number;
  memberCount?: number;
}

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findTree(tenantId: string): Promise<DeptTreeNode[]> {
    const depts = await this.deptRepo.find({
      where: { tenantId, isDeleted: false },
      order: { sortOrder: 'ASC' },
    });

    const nodeMap = new Map<string, DeptTreeNode>();
    for (const dept of depts) {
      nodeMap.set(dept.id, { ...dept, children: [] });
    }

    const roots: DeptTreeNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findMembersByDeptId(
    tenantId: string,
    deptId: string,
    page: number,
    limit: number,
  ): Promise<{ items: User[]; total: number }> {
    const [items, total] = await this.userRepo.findAndCount({
      where: { tenantId, departmentId: deptId },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async upsertBatch(tenantId: string, depts: UpsertDeptData[]): Promise<{ newDepts: number; updatedDepts: number }> {
    let newDepts = 0;
    let updatedDepts = 0;

    // Build a map: feishuDeptId → platform dept
    const feishuIds = depts.map((d) => d.feishuDeptId);
    const existing = await this.deptRepo.find({
      where: { tenantId, feishuDeptId: In(feishuIds) },
    });
    const existingMap = new Map(existing.map((d) => [d.feishuDeptId!, d]));

    // Build feishuDeptId → platform id map for parentId resolution
    // We need two passes: first insert all, then resolve parentIds
    // Pass 1: upsert all records (without parentId for new records)
    const savedDepts: Department[] = [];
    for (const data of depts) {
      const existing = existingMap.get(data.feishuDeptId);
      if (existing) {
        existing.name = data.name;
        existing.sortOrder = data.sortOrder ?? existing.sortOrder;
        existing.memberCount = data.memberCount ?? existing.memberCount;
        existing.isDeleted = false;
        const saved = await this.deptRepo.save(existing);
        savedDepts.push(saved);
        updatedDepts++;
      } else {
        const dept = this.deptRepo.create({
          tenantId,
          name: data.name,
          feishuDeptId: data.feishuDeptId,
          sortOrder: data.sortOrder ?? 0,
          memberCount: data.memberCount ?? 0,
          isDeleted: false,
        });
        const saved = await this.deptRepo.save(dept);
        savedDepts.push(saved);
        newDepts++;
      }
    }

    // Pass 2: resolve parentIds using feishuDeptId → uuid map
    const allDepts = await this.deptRepo.find({ where: { tenantId } });
    const feishuToId = new Map(allDepts.filter((d) => d.feishuDeptId).map((d) => [d.feishuDeptId!, d.id]));

    for (const data of depts) {
      if (data.parentFeishuDeptId && feishuToId.has(data.parentFeishuDeptId)) {
        const dept = allDepts.find((d) => d.feishuDeptId === data.feishuDeptId);
        if (dept) {
          dept.parentId = feishuToId.get(data.parentFeishuDeptId)!;
          await this.deptRepo.save(dept);
        }
      }
    }

    return { newDepts, updatedDepts };
  }

  async softDeleteMissing(tenantId: string, activeDeptFeishuIds: string[]): Promise<void> {
    const allDepts = await this.deptRepo.find({
      where: { tenantId, isDeleted: false },
    });
    const toDelete = allDepts.filter(
      (d) => d.feishuDeptId && !activeDeptFeishuIds.includes(d.feishuDeptId),
    );
    if (toDelete.length > 0) {
      for (const dept of toDelete) {
        dept.isDeleted = true;
      }
      await this.deptRepo.save(toDelete);
    }
  }

  async findByFeishuId(tenantId: string, feishuDeptId: string): Promise<Department | null> {
    return this.deptRepo.findOne({ where: { tenantId, feishuDeptId } });
  }
}
