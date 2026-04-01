# Sprint Contract: T4 — 自定义列管理后端 API

## 任务范围

**规划对应**：T14

## 交付物

### 1. Migration: `backend/src/database/migrations/1700000000021-AddProjectMetadata.ts`

- `ALTER TABLE projects ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'`
- `down()` 中 `DROP COLUMN metadata`

### 2. 更新 Project Entity: `backend/src/project/entities/project.entity.ts`

- 新增 `metadata` 字段：`@Column({ type: 'jsonb', default: {} })` + 类型 `ProjectMetadata`
- 定义接口：
  ```ts
  export interface FieldDef {
    key: string;
    name: string;
    type: 'text' | 'number' | 'date' | 'single_select' | 'multi_select';
    options?: string[];
    order: number;
  }
  export interface ProjectMetadata {
    customFields?: FieldDef[];
  }
  ```

### 3. DTO: `backend/src/project/dto/update-custom-fields.dto.ts`

```ts
class FieldDefDto {
  key: string;        // @IsString() @IsNotEmpty()
  name: string;       // @IsString() @IsNotEmpty()
  type: string;       // @IsIn(['text','number','date','single_select','multi_select'])
  options?: string[]; // @IsOptional() @IsArray() @IsString({ each: true })
  order: number;      // @IsInt()
}

class UpdateCustomFieldsDto {
  fields: FieldDefDto[];  // @IsArray() @ValidateNested({ each: true }) @Type(() => FieldDefDto)
}
```

### 4. ProjectService 新增方法: `backend/src/project/project.service.ts`

```ts
getCustomFields(projectId: string, tenantId: string): Promise<FieldDef[]>
updateCustomFields(projectId: string, tenantId: string, fields: FieldDef[]): Promise<FieldDef[]>
```

- `getCustomFields`: 查项目，返回 `project.metadata.customFields ?? []`
- `updateCustomFields`: 查项目（校验 tenantId），更新 `project.metadata = { ...project.metadata, customFields: fields }`，save，返回新 fields

### 5. ProjectController 新增端点: `backend/src/project/project.controller.ts`

```
GET  /projects/:id/custom-fields   → @CheckPolicies('projects', 'read')
PUT  /projects/:id/custom-fields   → @CheckPolicies('projects', 'update')
```

## 验收标准

1. `pnpm --filter backend run build` 编译通过，无 TypeScript 错误
2. Migration 文件存在，有 up/down
3. Project entity 有 `metadata: ProjectMetadata` 字段
4. `FieldDef` 和 `ProjectMetadata` 接口导出
5. `ProjectService` 有 `getCustomFields` 和 `updateCustomFields` 方法
6. Controller 有 `GET /:id/custom-fields` 和 `PUT /:id/custom-fields` 端点

## 不在此任务范围内

- 前端 ColumnManagerPanel（T5 的工作）
- TaskDataGrid 集成自定义列（T5 的工作）
