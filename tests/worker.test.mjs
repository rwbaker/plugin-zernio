import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestHarness } from '@paperclipai/plugin-sdk';

const manifest = (await import('../dist/zernio-manifest.mjs')).default;
const plugin = (await import('../dist/worker.mjs')).default.definition;

const origFetch = globalThis.fetch;

let fetchCalls = [];

beforeEach(() => {
  fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({ data: 'mock' }),
      text: async () => '',
    };
  };
});

afterEach(() => {
  globalThis.fetch = origFetch;
});

describe('worker', () => {
  describe('setup - tool registration', () => {
    it('registers all expected tools', async () => {
      const harness = createTestHarness({ manifest, config: { zernioApiKey: 'MY_SECRET' } });
      await plugin.setup(harness.ctx);

      const toolParams = {
        'zernio-list-accounts': {},
        'zernio-create-post': { content: 'test', platforms: [{ platform: 'twitter', accountId: 'a1' }] },
        'zernio-list-posts': {},
        'zernio-get-post': { postId: 'p1' },
        'zernio-delete-post': { postId: 'p1' },
        'zernio-retry-post': { postId: 'p1' },
        'zernio-get-analytics': {},
        'zernio-best-times': {},
        'zernio-list-conversations': {},
        'zernio-send-message': { conversationId: 'c1', text: 'hi' },
        'zernio-list-comments': {},
        'zernio-reply-comment': { postId: 'p1', text: 'reply' },
      };

      for (const [tool, params] of Object.entries(toolParams)) {
        const result = await harness.executeTool(tool, params);
        assert.ok(result, `tool ${tool} should be callable`);
      }
    });
  });

  describe('tool execution', () => {
    it('zernio-list-accounts calls the Zernio API', async () => {
      const harness = createTestHarness({ manifest, config: { zernioApiKey: 'MY_SECRET' } });
      await plugin.setup(harness.ctx);

      const result = await harness.executeTool('zernio-list-accounts', {});
      assert.ok(result.content);
      assert.equal(fetchCalls.length, 1);
      assert.ok(fetchCalls[0].url.includes('/accounts'));
    });

    it('zernio-create-post sends content and platforms', async () => {
      const harness = createTestHarness({ manifest, config: { zernioApiKey: 'MY_SECRET' } });
      await plugin.setup(harness.ctx);

      const result = await harness.executeTool('zernio-create-post', {
        content: 'Test post',
        platforms: [{ platform: 'twitter', accountId: 'acc1' }],
      });

      assert.ok(result.content);
      const body = JSON.parse(fetchCalls[0].init.body);
      assert.equal(body.content, 'Test post');
      assert.equal(body.platforms[0].platform, 'twitter');
    });

    it('zernio-list-posts passes status filter', async () => {
      const harness = createTestHarness({ manifest, config: { zernioApiKey: 'MY_SECRET' } });
      await plugin.setup(harness.ctx);

      await harness.executeTool('zernio-list-posts', { status: 'draft' });
      assert.ok(fetchCalls[0].url.includes('status=draft'));
    });

    it('zernio-delete-post removes a post', async () => {
      globalThis.fetch = async (url, init) => {
        fetchCalls.push({ url, init });
        return {
          ok: true,
          status: 204,
          headers: new Map(),
          json: async () => undefined,
          text: async () => '',
        };
      };

      const harness = createTestHarness({ manifest, config: { zernioApiKey: 'MY_SECRET' } });
      await plugin.setup(harness.ctx);

      const result = await harness.executeTool('zernio-delete-post', { postId: 'p1' });
      assert.ok(result.content.includes('p1'));
      assert.equal(fetchCalls[0].init.method, 'DELETE');
    });
  });

  describe('resolveApiKey', () => {
    it('resolves env secret name via ctx.secrets', async () => {
      const harness = createTestHarness({ manifest, config: { zernioApiKey: 'ZERNIO_API_KEY' } });
      await plugin.setup(harness.ctx);

      await harness.executeTool('zernio-list-accounts', {});
      const authHeader = fetchCalls[0].init.headers.Authorization;
      assert.equal(authHeader, 'Bearer resolved:ZERNIO_API_KEY');
    });

    it('uses raw key directly when it starts with sk_', async () => {
      const harness = createTestHarness({ manifest, config: { zernioApiKey: 'sk_live_abc123' } });
      await plugin.setup(harness.ctx);

      await harness.executeTool('zernio-list-accounts', {});
      const authHeader = fetchCalls[0].init.headers.Authorization;
      assert.equal(authHeader, 'Bearer sk_live_abc123');
    });

    it('uses raw key directly when it starts with sk-', async () => {
      const harness = createTestHarness({ manifest, config: { zernioApiKey: 'sk-test-key' } });
      await plugin.setup(harness.ctx);

      await harness.executeTool('zernio-list-accounts', {});
      const authHeader = fetchCalls[0].init.headers.Authorization;
      assert.equal(authHeader, 'Bearer sk-test-key');
    });
  });

  describe('onValidateConfig', () => {
    it('returns ok for valid config', async () => {
      const result = await plugin.onValidateConfig({ zernioApiKey: 'MY_KEY' });
      assert.equal(result.ok, true);
      assert.equal(result.errors.length, 0);
    });

    it('returns error when zernioApiKey is missing', async () => {
      const result = await plugin.onValidateConfig({});
      assert.equal(result.ok, false);
      assert.ok(result.errors.length > 0);
    });

    it('returns error when zernioApiKey is empty string', async () => {
      const result = await plugin.onValidateConfig({ zernioApiKey: '' });
      assert.equal(result.ok, false);
    });

    it('returns error when zernioApiKey is whitespace', async () => {
      const result = await plugin.onValidateConfig({ zernioApiKey: '   ' });
      assert.equal(result.ok, false);
    });

    it('returns error when zernioApiKey is not a string', async () => {
      const result = await plugin.onValidateConfig({ zernioApiKey: 123 });
      assert.equal(result.ok, false);
    });
  });

  describe('onHealth', () => {
    it('returns ok status', async () => {
      const result = await plugin.onHealth();
      assert.equal(result.status, 'ok');
    });
  });
});
