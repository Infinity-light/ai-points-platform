import databaseConfig from '../config/database.config';

describe('DatabaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use environment variables when set', () => {
    process.env.DB_HOST = 'custom-host';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'custom-user';
    process.env.DB_PASSWORD = 'custom-pass';
    process.env.DB_NAME = 'custom-db';

    const config = databaseConfig();

    expect(config.host).toBe('custom-host');
    expect(config.port).toBe(5433);
    expect(config.username).toBe('custom-user');
    expect(config.password).toBe('custom-pass');
    expect(config.database).toBe('custom-db');
  });

  it('should use default values when env vars not set', () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;

    const config = databaseConfig();

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
    expect(config.username).toBe('postgres');
    expect(config.password).toBe('postgres');
    expect(config.database).toBe('ai_points_platform');
  });
});
