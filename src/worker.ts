import { definePlugin, runWorker } from '@paperclipai/plugin-sdk';
import { ZernioClient, ZernioApiError } from './zernio-client.js';

function getClient(ctx: { config: unknown }): ZernioClient {
  const config = ctx.config as Record<string, unknown>;
  const apiKey = config.zernioApiKey as string | undefined;
  if (!apiKey) throw new Error('Zernio API key is not configured.');
  return new ZernioClient({ apiKey });
}

const plugin = definePlugin({
  async setup(ctx) {
    // --- Tools: Accounts ---

    ctx.tools.register(
      'zernio-list-accounts',
      {
        displayName: 'List Zernio Accounts',
        description: 'List all connected social media accounts in Zernio.',
        parametersSchema: { type: 'object', properties: {} },
      },
      async () => {
        const client = getClient(ctx);
        const accounts = await client.listAccounts();
        return { content: JSON.stringify(accounts, null, 2) };
      },
    );

    // --- Tools: Posts ---

    ctx.tools.register(
      'zernio-create-post',
      {
        displayName: 'Create Zernio Post',
        description:
          'Create, schedule, or immediately publish a post to one or more social platforms via Zernio.',
        parametersSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The text content of the post.',
            },
            platforms: {
              type: 'array',
              description: 'Platforms to publish to.',
              items: {
                type: 'object',
                properties: {
                  platform: {
                    type: 'string',
                    description:
                      'Platform name (twitter, instagram, linkedin, bluesky, facebook, threads, tiktok, youtube, pinterest, reddit, discord, telegram, snapchat, google_business).',
                  },
                  accountId: {
                    type: 'string',
                    description: 'The Zernio account ID for this platform.',
                  },
                },
                required: ['platform', 'accountId'],
              },
            },
            publishNow: {
              type: 'boolean',
              description: 'Publish immediately instead of saving as draft.',
            },
            scheduledFor: {
              type: 'string',
              description:
                'ISO 8601 datetime to schedule the post (e.g. 2026-01-16T12:00:00).',
            },
            timezone: {
              type: 'string',
              description:
                'Timezone for scheduledFor (e.g. America/New_York). Defaults to UTC.',
            },
            mediaItems: {
              type: 'array',
              description: 'Media attachments.',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['image', 'video'],
                  },
                  url: {
                    type: 'string',
                    description: 'Public URL of the media file.',
                  },
                },
                required: ['type', 'url'],
              },
            },
          },
          required: ['content', 'platforms'],
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const result = await client.createPost(params as any);
        return { content: JSON.stringify(result, null, 2) };
      },
    );

    ctx.tools.register(
      'zernio-list-posts',
      {
        displayName: 'List Zernio Posts',
        description:
          'List posts in Zernio. Optionally filter by status: draft, scheduled, published, or failed.',
        parametersSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['draft', 'scheduled', 'published', 'failed'],
              description: 'Filter by post status.',
            },
            limit: { type: 'number', description: 'Max results.' },
            offset: { type: 'number', description: 'Pagination offset.' },
          },
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const result = await client.listPosts(params as any);
        return { content: JSON.stringify(result, null, 2) };
      },
    );

    ctx.tools.register(
      'zernio-get-post',
      {
        displayName: 'Get Zernio Post',
        description: 'Get details of a specific Zernio post by ID.',
        parametersSchema: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'The post ID.' },
          },
          required: ['postId'],
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const p = params as { postId: string };
        const result = await client.getPost(p.postId);
        return { content: JSON.stringify(result, null, 2) };
      },
    );

    ctx.tools.register(
      'zernio-delete-post',
      {
        displayName: 'Delete Zernio Post',
        description: 'Delete a Zernio post by ID.',
        parametersSchema: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'The post ID to delete.' },
          },
          required: ['postId'],
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const p = params as { postId: string };
        await client.deletePost(p.postId);
        return { content: `Post ${p.postId} deleted.` };
      },
    );

    ctx.tools.register(
      'zernio-retry-post',
      {
        displayName: 'Retry Failed Zernio Post',
        description: 'Retry publishing a failed Zernio post.',
        parametersSchema: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'The failed post ID.' },
          },
          required: ['postId'],
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const p = params as { postId: string };
        const result = await client.retryPost(p.postId);
        return { content: JSON.stringify(result, null, 2) };
      },
    );

    // --- Tools: Analytics ---

    ctx.tools.register(
      'zernio-get-analytics',
      {
        displayName: 'Get Zernio Analytics',
        description:
          'Get post performance analytics (likes, comments, shares, reach).',
        parametersSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'Filter by account ID.',
            },
            startDate: {
              type: 'string',
              description: 'Start date (YYYY-MM-DD).',
            },
            endDate: {
              type: 'string',
              description: 'End date (YYYY-MM-DD).',
            },
          },
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const result = await client.getAnalytics(params as any);
        return { content: JSON.stringify(result, null, 2) };
      },
    );

    ctx.tools.register(
      'zernio-best-times',
      {
        displayName: 'Get Best Posting Times',
        description: 'Get optimal posting times based on audience engagement.',
        parametersSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'Account ID to analyze.',
            },
          },
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const p = params as { accountId?: string };
        const result = await client.getBestTimes(p.accountId);
        return { content: JSON.stringify(result, null, 2) };
      },
    );

    // --- Tools: Inbox ---

    ctx.tools.register(
      'zernio-list-conversations',
      {
        displayName: 'List Zernio Conversations',
        description: 'List inbox DM conversation threads.',
        parametersSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max results.' },
            offset: { type: 'number', description: 'Pagination offset.' },
          },
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const p = params as { limit?: number; offset?: number };
        const result = await client.listConversations(p.limit, p.offset);
        return { content: JSON.stringify(result, null, 2) };
      },
    );

    ctx.tools.register(
      'zernio-send-message',
      {
        displayName: 'Send Zernio Message',
        description: 'Send a direct message in a Zernio conversation.',
        parametersSchema: {
          type: 'object',
          properties: {
            conversationId: {
              type: 'string',
              description: 'The conversation ID.',
            },
            text: { type: 'string', description: 'Message text to send.' },
          },
          required: ['conversationId', 'text'],
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const result = await client.sendMessage(params as any);
        return { content: JSON.stringify(result, null, 2) };
      },
    );

    ctx.tools.register(
      'zernio-list-comments',
      {
        displayName: 'List Zernio Comments',
        description: 'List comments across connected social accounts.',
        parametersSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max results.' },
            offset: { type: 'number', description: 'Pagination offset.' },
          },
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const p = params as { limit?: number; offset?: number };
        const result = await client.listComments(p.limit, p.offset);
        return { content: JSON.stringify(result, null, 2) };
      },
    );

    ctx.tools.register(
      'zernio-reply-comment',
      {
        displayName: 'Reply to Zernio Comment',
        description: 'Reply to a comment on a social media post.',
        parametersSchema: {
          type: 'object',
          properties: {
            postId: {
              type: 'string',
              description: 'The post ID containing the comment.',
            },
            text: { type: 'string', description: 'Reply text.' },
          },
          required: ['postId', 'text'],
        },
      },
      async (params) => {
        const client = getClient(ctx);
        const result = await client.replyToComment(params as any);
        return { content: JSON.stringify(result, null, 2) };
      },
    );
  },

  async onValidateConfig(config: Record<string, unknown>) {
    const errors: string[] = [];
    const apiKey = config.zernioApiKey as string | undefined;
    if (!apiKey) {
      errors.push('Zernio API key is required.');
    } else if (!apiKey.startsWith('sk_')) {
      errors.push('Zernio API key must start with "sk_".');
    }
    return { ok: errors.length === 0, errors };
  },

  async onWebhook(input) {
    const event = input.parsedBody as Record<string, unknown> | undefined;
    if (event) {
      const eventType = event.type as string | undefined;
      if (eventType) {
        console.log(`[zernio] webhook received: ${eventType} (id=${event.id})`);
      }
    }
  },

  async onHealth() {
    return { status: 'ok', message: 'Zernio plugin is running.' };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
