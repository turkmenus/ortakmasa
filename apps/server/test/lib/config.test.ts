import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { storageProviderConfigSchema } from '@colanode/server/lib/config/storage';

describe('storage config schema', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('parses S3 storage config with literal values', () => {
    const parsed = storageProviderConfigSchema.parse({
      type: 's3',
      endpoint: 'https://s3.amazonaws.com',
      accessKey: 'my-access-key',
      secretKey: 'my-secret-key',
      bucket: 'my-bucket',
      region: 'eu-central-1',
      forcePathStyle: false,
    });

    expect(parsed).toEqual({
      type: 's3',
      endpoint: 'https://s3.amazonaws.com',
      accessKey: 'my-access-key',
      secretKey: 'my-secret-key',
      bucket: 'my-bucket',
      region: 'eu-central-1',
      forcePathStyle: false,
    });
  });

  it('parses S3 storage config with env:// references including region and forcePathStyle', () => {
    process.env.S3_ENDPOINT = 'http://minio:9000';
    process.env.S3_ACCESS_KEY = 'minioadmin';
    process.env.S3_SECRET_KEY = 'miniopassword';
    process.env.S3_BUCKET = 'ortakmasa';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_FORCE_PATH_STYLE = 'true';

    const parsed = storageProviderConfigSchema.parse({
      type: 's3',
      endpoint: 'env://S3_ENDPOINT',
      accessKey: 'env://S3_ACCESS_KEY',
      secretKey: 'env://S3_SECRET_KEY',
      bucket: 'env://S3_BUCKET',
      region: 'env://S3_REGION',
      forcePathStyle: 'env://S3_FORCE_PATH_STYLE',
    });

    expect(parsed).toEqual({
      type: 's3',
      endpoint: 'http://minio:9000',
      accessKey: 'minioadmin',
      secretKey: 'miniopassword',
      bucket: 'ortakmasa',
      region: 'us-east-1',
      forcePathStyle: true,
    });
  });

  it('defaults region to us-east-1 if omitted or empty string', () => {
    const parsed = storageProviderConfigSchema.parse({
      type: 's3',
      endpoint: 'http://localhost:9000',
      accessKey: 'minioadmin',
      secretKey: 'miniopassword',
      bucket: 'ortakmasa',
    });

    expect(parsed.type).toBe('s3');
    if (parsed.type === 's3') {
      expect(parsed.region).toBe('us-east-1');
    }
  });

  it('auto-detects S3 configuration from environment variables when undefined input', () => {
    process.env.S3_ENDPOINT = 'http://coolify-minio:9000';
    process.env.S3_ACCESS_KEY = 'coolifyuser';
    process.env.S3_SECRET_KEY = 'coolifypass';
    process.env.S3_BUCKET = 'ortakmasa-bucket';
    process.env.S3_FORCE_PATH_STYLE = '1';

    const parsed = storageProviderConfigSchema.parse(undefined);

    expect(parsed).toEqual({
      type: 's3',
      endpoint: 'http://coolify-minio:9000',
      accessKey: 'coolifyuser',
      secretKey: 'coolifypass',
      bucket: 'ortakmasa-bucket',
      region: 'us-east-1',
      forcePathStyle: true,
    });
  });
});
