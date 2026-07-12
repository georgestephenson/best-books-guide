import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies defaults when the environment is empty', () => {
    const cfg = loadConfig({});
    expect(cfg).toMatchObject({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 3000,
      LOG_LEVEL: 'info',
      APP_VERSION: 'dev',
    });
  });

  it('coerces a string PORT into a number', () => {
    expect(loadConfig({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('throws with a helpful message on an out-of-range PORT', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/environment configuration/i);
  });

  it('throws on a non-numeric PORT', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/environment configuration/i);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadConfig({ NODE_ENV: 'staging' })).toThrow(/environment configuration/i);
  });
});
