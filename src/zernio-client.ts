export const BASE_URL = 'https://zernio.com/api/v1';

export class ZernioApiError extends Error {
  statusCode: number;
  body: unknown;
  constructor(message: string, statusCode: number, body?: unknown) {
    super(message);
    this.name = 'ZernioApiError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class ZernioRateLimitError extends ZernioApiError {
  retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number) {
    super(message, 429);
    this.name = 'ZernioRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ZernioClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface CreatePostParams {
  content: string;
  platforms: Array<{
    platform: string;
    accountId: string;
    platformSpecificData?: Record<string, unknown>;
  }>;
  publishNow?: boolean;
  scheduledFor?: string;
  timezone?: string;
  mediaItems?: Array<{ type: 'image' | 'video'; url: string }>;
  customContent?: Record<string, unknown>;
  customMedia?: Record<string, unknown>;
}

export interface ListPostsParams {
  status?: 'draft' | 'scheduled' | 'published' | 'failed';
  limit?: number;
  offset?: number;
}

export interface SendMessageParams {
  conversationId: string;
  text: string;
}

export interface ReplyCommentParams {
  postId: string;
  text: string;
}

export interface AnalyticsParams {
  accountId?: string;
  startDate?: string;
  endDate?: string;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is required and must be a non-empty string.`);
  }
  return value;
}

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment);
}

export class ZernioClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: ZernioClientOptions) {
    if (!options.apiKey) throw new Error('apiKey is required.');
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? BASE_URL;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10);
      throw new ZernioRateLimitError('Zernio rate limit exceeded', retryAfter);
    }

    if (!res.ok) {
      let errBody: unknown;
      try {
        errBody = await res.json();
      } catch {
        errBody = await res.text();
      }
      throw new ZernioApiError(
        `Zernio API error ${res.status} on ${method} ${path}`,
        res.status,
        errBody,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // --- Accounts ---

  async listAccounts() {
    return this.request('GET', '/accounts');
  }

  // --- Posts ---

  async createPost(params: CreatePostParams) {
    return this.request('POST', '/posts', params);
  }

  async listPosts(params?: ListPostsParams) {
    return this.request('GET', '/posts', undefined, params as Record<string, string | number | undefined>);
  }

  async getPost(postId: string) {
    requireString(postId, 'postId');
    return this.request('GET', `/posts/${encodePathSegment(postId)}`);
  }

  async updatePost(postId: string, params: Partial<CreatePostParams>) {
    requireString(postId, 'postId');
    return this.request('PUT', `/posts/${encodePathSegment(postId)}`, params);
  }

  async deletePost(postId: string) {
    requireString(postId, 'postId');
    return this.request('DELETE', `/posts/${encodePathSegment(postId)}`);
  }

  async retryPost(postId: string) {
    requireString(postId, 'postId');
    return this.request('POST', `/posts/${encodePathSegment(postId)}/retry`);
  }

  // --- Analytics ---

  async getAnalytics(params?: AnalyticsParams) {
    return this.request('GET', '/analytics', undefined, params as Record<string, string | undefined>);
  }

  async getBestTimes(accountId?: string) {
    return this.request('GET', '/analytics/best-time', undefined, accountId ? { accountId } : undefined);
  }

  async getDailyAnalytics(params?: AnalyticsParams) {
    return this.request('GET', '/analytics/daily', undefined, params as Record<string, string | undefined>);
  }

  // --- Inbox ---

  async listConversations(limit?: number, offset?: number) {
    return this.request('GET', '/inbox/conversations', undefined, { limit, offset });
  }

  async getConversation(conversationId: string) {
    requireString(conversationId, 'conversationId');
    return this.request('GET', `/inbox/conversations/${encodePathSegment(conversationId)}`);
  }

  async listMessages(conversationId: string) {
    requireString(conversationId, 'conversationId');
    return this.request('GET', `/inbox/messages/${encodePathSegment(conversationId)}`);
  }

  async sendMessage(params: SendMessageParams) {
    requireString(params.conversationId, 'conversationId');
    requireString(params.text, 'text');
    return this.request('POST', `/inbox/messages/${encodePathSegment(params.conversationId)}`, {
      text: params.text,
    });
  }

  async listComments(limit?: number, offset?: number) {
    return this.request('GET', '/inbox/comments', undefined, { limit, offset });
  }

  async replyToComment(params: ReplyCommentParams) {
    requireString(params.postId, 'postId');
    requireString(params.text, 'text');
    return this.request('POST', `/inbox/comments/${encodePathSegment(params.postId)}/reply`, {
      text: params.text,
    });
  }

  // --- Profiles ---

  async listProfiles() {
    return this.request('GET', '/profiles');
  }

  async createProfile(name: string) {
    requireString(name, 'name');
    return this.request('POST', '/profiles', { name });
  }

  // --- Webhooks ---

  async createWebhook(url: string, events: string[]) {
    requireString(url, 'url');
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('events must be a non-empty array.');
    }
    return this.request('POST', '/webhooks', { url, events });
  }

  async deleteWebhook(webhookId: string) {
    requireString(webhookId, 'webhookId');
    return this.request('DELETE', `/webhooks/${encodePathSegment(webhookId)}`);
  }
}
