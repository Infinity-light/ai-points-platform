import AppDataSource from './data-source';

async function seed() {
  console.log('Connecting to database...');
  await AppDataSource.initialize();
  console.log('Connected. Running seeds...');

  // Seeds 将在各模块实现后添加（Tenant、User 等）
  // 目前仅验证连接正常

  console.log('Seeds completed.');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
