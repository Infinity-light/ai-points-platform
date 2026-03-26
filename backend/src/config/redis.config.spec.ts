import redisConfig from './redis.config';

describe('RedisConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use environment variables when set', () => {
    process.env.REDIS_HOST = 'custom-redis';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_DB = '1';

    const config = redisConfig();

    expect(config.host).toBe('custom-redis');
    expect(config.port).toBe(6380);
    expect(config.db).toBe(1);
  });

  it('should use default values when env vars not set', () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_DB;

    const config = redisConfig();

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(6379);
    expect(config.db).toBe(0);
  });

  it('should return undefined password when REDIS_PASSWORD is not set', () => {
    delete process.env.REDIS_PASSWORD;
    const config = redisConfig();
    expect(config.password).toBeUndefined();
  });
});
