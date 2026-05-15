import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { ZernioClient, ZernioApiError, ZernioRateLimitError, BASE_URL } =
  await import('../dist/zernio-client.mjs');

let fetchCalls = [];
let fetchResponse = { ok: true, status: 200, json: async () => ({}) };

const origFetch = globalThis.fetch;

beforeEach(() => {
  fetchCalls = [];
  fetchResponse = {
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => ({ data: 'ok' }),
    text: async () => '',
  };
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return fetchResponse;
  };
});

afterEach(() => {
  globalThis.fetch = origFetch;
});

describe('ZernioClient', () => {
  describe('constructor', () => {
    it('throws when apiKey is missing', () => {
      assert.throws(() => new ZernioClient({}), /apiKey is required/);
    });

    it('creates a client with valid apiKey', () => {
      const client = new ZernioClient({ apiKey: 'sk_test_123' });
      assert.ok(client);
    });

    it('accepts a custom baseUrl', () => {
      const client = new ZernioClient({ apiKey: 'sk_test', baseUrl: 'https://custom.api' });
      assert.ok(client);
    });
  });

  describe('request headers', () => {
    it('sends Authorization Bearer header', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test_abc' });
      await client.listAccounts();
      assert.equal(fetchCalls.length, 1);
      assert.equal(fetchCalls[0].init.headers.Authorization, 'Bearer sk_test_abc');
    });

    it('sends Content-Type header', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test_abc' });
      await client.listAccounts();
      assert.equal(fetchCalls[0].init.headers['Content-Type'], 'application/json');
    });
  });

  describe('listAccounts', () => {
    it('calls GET /accounts', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await client.listAccounts();
      assert.equal(fetchCalls.length, 1);
      assert.ok(fetchCalls[0].url.includes('/accounts'));
      assert.equal(fetchCalls[0].init.method, 'GET');
    });
  });

  describe('createPost', () => {
    it('calls POST /posts with body', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      const params = {
        content: 'Hello world',
        platforms: [{ platform: 'twitter', accountId: 'acc1' }],
      };
      await client.createPost(params);
      assert.equal(fetchCalls[0].init.method, 'POST');
      assert.ok(fetchCalls[0].url.includes('/posts'));
      const body = JSON.parse(fetchCalls[0].init.body);
      assert.equal(body.content, 'Hello world');
    });
  });

  describe('getPost', () => {
    it('validates postId', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await assert.rejects(() => client.getPost(''), /postId is required/);
    });

    it('encodes postId in path', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await client.getPost('post/123');
      assert.ok(fetchCalls[0].url.includes('/posts/post%2F123'));
    });
  });

  describe('deletePost', () => {
    it('validates postId', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await assert.rejects(() => client.deletePost(''), /postId is required/);
    });

    it('calls DELETE /posts/:id', async () => {
      fetchResponse.status = 204;
      fetchResponse.json = async () => undefined;
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await client.deletePost('p1');
      assert.equal(fetchCalls[0].init.method, 'DELETE');
    });
  });

  describe('sendMessage', () => {
    it('validates conversationId', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await assert.rejects(
        () => client.sendMessage({ conversationId: '', text: 'hi' }),
        /conversationId is required/,
      );
    });

    it('validates text', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await assert.rejects(
        () => client.sendMessage({ conversationId: 'c1', text: '' }),
        /text is required/,
      );
    });
  });

  describe('createWebhook', () => {
    it('validates url', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await assert.rejects(
        () => client.createWebhook('', ['post.published']),
        /url is required/,
      );
    });

    it('validates events array', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await assert.rejects(
        () => client.createWebhook('https://example.com/hook', []),
        /events must be a non-empty array/,
      );
    });
  });

  describe('error handling', () => {
    it('throws ZernioRateLimitError on 429', async () => {
      fetchResponse = {
        ok: false,
        status: 429,
        headers: new Map([['retry-after', '30']]),
      };
      fetchResponse.headers.get = (k) =>
        k === 'retry-after' ? '30' : null;

      const client = new ZernioClient({ apiKey: 'sk_test' });
      try {
        await client.listAccounts();
        assert.fail('should throw');
      } catch (err) {
        assert.equal(err.name, 'ZernioRateLimitError');
        assert.equal(err.statusCode, 429);
        assert.equal(err.retryAfterSeconds, 30);
      }
    });

    it('throws ZernioApiError on non-OK response', async () => {
      fetchResponse = {
        ok: false,
        status: 403,
        headers: new Map(),
        json: async () => ({ error: 'forbidden' }),
      };
      fetchResponse.headers.get = () => null;

      const client = new ZernioClient({ apiKey: 'sk_test' });
      try {
        await client.listAccounts();
        assert.fail('should throw');
      } catch (err) {
        assert.equal(err.name, 'ZernioApiError');
        assert.equal(err.statusCode, 403);
      }
    });
  });

  describe('query parameters', () => {
    it('passes status filter on listPosts', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await client.listPosts({ status: 'published', limit: 10 });
      const url = fetchCalls[0].url;
      assert.ok(url.includes('status=published'));
      assert.ok(url.includes('limit=10'));
    });

    it('passes analytics date range', async () => {
      const client = new ZernioClient({ apiKey: 'sk_test' });
      await client.getAnalytics({ startDate: '2026-01-01', endDate: '2026-01-31' });
      const url = fetchCalls[0].url;
      assert.ok(url.includes('startDate=2026-01-01'));
      assert.ok(url.includes('endDate=2026-01-31'));
    });
  });
});
