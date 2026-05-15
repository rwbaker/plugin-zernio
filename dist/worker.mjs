// src/worker.ts
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

// src/zernio-client.ts
var BASE_URL = "https://zernio.com/api/v1";
var ZernioApiError = class extends Error {
  statusCode;
  body;
  constructor(message, statusCode, body) {
    super(message);
    this.name = "ZernioApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
};
var ZernioRateLimitError = class extends ZernioApiError {
  retryAfterSeconds;
  constructor(message, retryAfterSeconds) {
    super(message, 429);
    this.name = "ZernioRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
};
function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required and must be a non-empty string.`);
  }
  return value;
}
function encodePathSegment(segment) {
  return encodeURIComponent(segment);
}
var ZernioClient = class {
  apiKey;
  baseUrl;
  constructor(options) {
    if (!options.apiKey) throw new Error("apiKey is required.");
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? BASE_URL;
  }
  async request(method, path, body, query) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== void 0) url.searchParams.set(k, String(v));
      }
    }
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    };
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : void 0
    });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") ?? "60", 10);
      throw new ZernioRateLimitError("Zernio rate limit exceeded", retryAfter);
    }
    if (!res.ok) {
      let errBody;
      try {
        errBody = await res.json();
      } catch {
        errBody = await res.text();
      }
      throw new ZernioApiError(
        `Zernio API error ${res.status} on ${method} ${path}`,
        res.status,
        errBody
      );
    }
    if (res.status === 204) return void 0;
    return await res.json();
  }
  // --- Accounts ---
  async listAccounts() {
    return this.request("GET", "/accounts");
  }
  // --- Posts ---
  async createPost(params) {
    return this.request("POST", "/posts", params);
  }
  async listPosts(params) {
    return this.request("GET", "/posts", void 0, params);
  }
  async getPost(postId) {
    requireString(postId, "postId");
    return this.request("GET", `/posts/${encodePathSegment(postId)}`);
  }
  async updatePost(postId, params) {
    requireString(postId, "postId");
    return this.request("PUT", `/posts/${encodePathSegment(postId)}`, params);
  }
  async deletePost(postId) {
    requireString(postId, "postId");
    return this.request("DELETE", `/posts/${encodePathSegment(postId)}`);
  }
  async retryPost(postId) {
    requireString(postId, "postId");
    return this.request("POST", `/posts/${encodePathSegment(postId)}/retry`);
  }
  // --- Analytics ---
  async getAnalytics(params) {
    return this.request("GET", "/analytics", void 0, params);
  }
  async getBestTimes(accountId) {
    return this.request("GET", "/analytics/best-time", void 0, accountId ? { accountId } : void 0);
  }
  async getDailyAnalytics(params) {
    return this.request("GET", "/analytics/daily", void 0, params);
  }
  // --- Inbox ---
  async listConversations(limit, offset) {
    return this.request("GET", "/inbox/conversations", void 0, { limit, offset });
  }
  async getConversation(conversationId) {
    requireString(conversationId, "conversationId");
    return this.request("GET", `/inbox/conversations/${encodePathSegment(conversationId)}`);
  }
  async listMessages(conversationId) {
    requireString(conversationId, "conversationId");
    return this.request("GET", `/inbox/messages/${encodePathSegment(conversationId)}`);
  }
  async sendMessage(params) {
    requireString(params.conversationId, "conversationId");
    requireString(params.text, "text");
    return this.request("POST", `/inbox/messages/${encodePathSegment(params.conversationId)}`, {
      text: params.text
    });
  }
  async listComments(limit, offset) {
    return this.request("GET", "/inbox/comments", void 0, { limit, offset });
  }
  async replyToComment(params) {
    requireString(params.postId, "postId");
    requireString(params.text, "text");
    return this.request("POST", `/inbox/comments/${encodePathSegment(params.postId)}/reply`, {
      text: params.text
    });
  }
  // --- Profiles ---
  async listProfiles() {
    return this.request("GET", "/profiles");
  }
  async createProfile(name) {
    requireString(name, "name");
    return this.request("POST", "/profiles", { name });
  }
  // --- Webhooks ---
  async createWebhook(url, events) {
    requireString(url, "url");
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error("events must be a non-empty array.");
    }
    return this.request("POST", "/webhooks", { url, events });
  }
  async deleteWebhook(webhookId) {
    requireString(webhookId, "webhookId");
    return this.request("DELETE", `/webhooks/${encodePathSegment(webhookId)}`);
  }
};

// src/worker.ts
var RAW_KEY_PREFIX = /^sk[_-]/;
async function resolveApiKey(secrets, value) {
  if (RAW_KEY_PREFIX.test(value)) return value;
  try {
    return await secrets.resolve(value);
  } catch {
    return value;
  }
}
async function getClient(ctx) {
  const config = await ctx.config.get();
  const keyValue = config.zernioApiKey;
  if (!keyValue) throw new Error("Zernio API key is not configured.");
  const apiKey = await resolveApiKey(ctx.secrets, keyValue);
  return new ZernioClient({ apiKey });
}
var plugin = definePlugin({
  async setup(ctx) {
    ctx.tools.register(
      "zernio-list-accounts",
      {
        displayName: "List Zernio Accounts",
        description: "List all connected social media accounts in Zernio.",
        parametersSchema: { type: "object", properties: {} }
      },
      async () => {
        const client = await getClient(ctx);
        const accounts = await client.listAccounts();
        return { content: JSON.stringify(accounts, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-create-post",
      {
        displayName: "Create Zernio Post",
        description: "Create, schedule, or immediately publish a post to one or more social platforms via Zernio.",
        parametersSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The text content of the post."
            },
            platforms: {
              type: "array",
              description: "Platforms to publish to.",
              items: {
                type: "object",
                properties: {
                  platform: {
                    type: "string",
                    description: "Platform name (twitter, instagram, linkedin, bluesky, facebook, threads, tiktok, youtube, pinterest, reddit, discord, telegram, snapchat, google_business)."
                  },
                  accountId: {
                    type: "string",
                    description: "The Zernio account ID for this platform."
                  }
                },
                required: ["platform", "accountId"]
              }
            },
            publishNow: {
              type: "boolean",
              description: "Publish immediately instead of saving as draft."
            },
            scheduledFor: {
              type: "string",
              description: "ISO 8601 datetime to schedule the post (e.g. 2026-01-16T12:00:00)."
            },
            timezone: {
              type: "string",
              description: "Timezone for scheduledFor (e.g. America/New_York). Defaults to UTC."
            },
            mediaItems: {
              type: "array",
              description: "Media attachments.",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["image", "video"]
                  },
                  url: {
                    type: "string",
                    description: "Public URL of the media file."
                  }
                },
                required: ["type", "url"]
              }
            }
          },
          required: ["content", "platforms"]
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const result = await client.createPost(params);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-list-posts",
      {
        displayName: "List Zernio Posts",
        description: "List posts in Zernio. Optionally filter by status: draft, scheduled, published, or failed.",
        parametersSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["draft", "scheduled", "published", "failed"],
              description: "Filter by post status."
            },
            limit: { type: "number", description: "Max results." },
            offset: { type: "number", description: "Pagination offset." }
          }
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const result = await client.listPosts(params);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-get-post",
      {
        displayName: "Get Zernio Post",
        description: "Get details of a specific Zernio post by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            postId: { type: "string", description: "The post ID." }
          },
          required: ["postId"]
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const p = params;
        const result = await client.getPost(p.postId);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-delete-post",
      {
        displayName: "Delete Zernio Post",
        description: "Delete a Zernio post by ID.",
        parametersSchema: {
          type: "object",
          properties: {
            postId: { type: "string", description: "The post ID to delete." }
          },
          required: ["postId"]
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const p = params;
        await client.deletePost(p.postId);
        return { content: `Post ${p.postId} deleted.` };
      }
    );
    ctx.tools.register(
      "zernio-retry-post",
      {
        displayName: "Retry Failed Zernio Post",
        description: "Retry publishing a failed Zernio post.",
        parametersSchema: {
          type: "object",
          properties: {
            postId: { type: "string", description: "The failed post ID." }
          },
          required: ["postId"]
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const p = params;
        const result = await client.retryPost(p.postId);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-get-analytics",
      {
        displayName: "Get Zernio Analytics",
        description: "Get post performance analytics (likes, comments, shares, reach).",
        parametersSchema: {
          type: "object",
          properties: {
            accountId: {
              type: "string",
              description: "Filter by account ID."
            },
            startDate: {
              type: "string",
              description: "Start date (YYYY-MM-DD)."
            },
            endDate: {
              type: "string",
              description: "End date (YYYY-MM-DD)."
            }
          }
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const result = await client.getAnalytics(params);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-best-times",
      {
        displayName: "Get Best Posting Times",
        description: "Get optimal posting times based on audience engagement.",
        parametersSchema: {
          type: "object",
          properties: {
            accountId: {
              type: "string",
              description: "Account ID to analyze."
            }
          }
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const p = params;
        const result = await client.getBestTimes(p.accountId);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-list-conversations",
      {
        displayName: "List Zernio Conversations",
        description: "List inbox DM conversation threads.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max results." },
            offset: { type: "number", description: "Pagination offset." }
          }
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const p = params;
        const result = await client.listConversations(p.limit, p.offset);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-send-message",
      {
        displayName: "Send Zernio Message",
        description: "Send a direct message in a Zernio conversation.",
        parametersSchema: {
          type: "object",
          properties: {
            conversationId: {
              type: "string",
              description: "The conversation ID."
            },
            text: { type: "string", description: "Message text to send." }
          },
          required: ["conversationId", "text"]
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const result = await client.sendMessage(params);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-list-comments",
      {
        displayName: "List Zernio Comments",
        description: "List comments across connected social accounts.",
        parametersSchema: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Max results." },
            offset: { type: "number", description: "Pagination offset." }
          }
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const p = params;
        const result = await client.listComments(p.limit, p.offset);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
    ctx.tools.register(
      "zernio-reply-comment",
      {
        displayName: "Reply to Zernio Comment",
        description: "Reply to a comment on a social media post.",
        parametersSchema: {
          type: "object",
          properties: {
            postId: {
              type: "string",
              description: "The post ID containing the comment."
            },
            text: { type: "string", description: "Reply text." }
          },
          required: ["postId", "text"]
        }
      },
      async (params) => {
        const client = await getClient(ctx);
        const result = await client.replyToComment(params);
        return { content: JSON.stringify(result, null, 2) };
      }
    );
  },
  async onValidateConfig(config) {
    const errors = [];
    const key = config.zernioApiKey;
    if (!key || typeof key !== "string" || key.trim().length === 0) {
      errors.push("Zernio API key is required. Provide a secret name or raw key.");
    }
    return { ok: errors.length === 0, errors };
  },
  async onWebhook(input) {
    const event = input.parsedBody;
    if (event) {
      const eventType = event.type;
      if (eventType) {
        console.log(`[zernio] webhook received: ${eventType} (id=${event.id})`);
      }
    }
  },
  async onHealth() {
    return { status: "ok", message: "Zernio plugin is running." };
  }
});
var worker_default = plugin;
runWorker(plugin, import.meta.url);
export {
  worker_default as default
};
//# sourceMappingURL=worker.mjs.map
