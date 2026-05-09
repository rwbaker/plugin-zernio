const BASE_URL = 'https://zernio.com/api/v1';

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

export class ZernioClient {
  private apiKey: string;

  constructor(options: ZernioClientOptions) {
    this.apiKey = options.apiKey;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
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
      throw new ZernioRateLimitError(
        `Zernio rate limit exceeded`,
        retryAfter,
      );
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
    return this.request('GET', `/posts/${postId}`);
  }

  async updatePost(postId: string, params: Partial<CreatePostParams>) {
    return this.request('PUT', `/posts/${postId}`, params);
  }

  async deletePost(postId: string) {
    return this.request('DELETE', `/posts/${postId}`);
  }

  async retryPost(postId: string) {
    return this.request('POST', `/posts/${postId}/retry`);
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
    return this.request('GET', `/inbox/conversations/${conversationId}`);
  }

  async listMessages(conversationId: string) {
    return this.request('GET', `/inbox/messages/${conversationId}`);
  }

  async sendMessage(params: SendMessageParams) {
    return this.request('POST', `/inbox/messages/${params.conversationId}`, {
      text: params.text,
    });
  }

  async listComments(limit?: number, offset?: number) {
    return this.request('GET', '/inbox/comments', undefined, { limit, offset });
  }

  async replyToComment(params: ReplyCommentParams) {
    return this.request('POST', `/inbox/comments/${params.postId}/reply`, {
      text: params.text,
    });
  }

  // --- Profiles ---

  async listProfiles() {
    return this.request('GET', '/profiles');
  }

  async createProfile(name: string) {
    return this.request('POST', '/profiles', { name });
  }

  // --- Webhooks ---

  async createWebhook(url: string, events: string[]) {
    return this.request('POST', '/webhooks', { url, events });
  }

  async deleteWebhook(webhookId: string) {
    return this.request('DELETE', `/webhooks/${webhookId}`);
  }
}
