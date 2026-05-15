# plugin-zernio

Paperclip plugin for the [Zernio](https://zernio.com) social media management API.

[Zernio](https://zernio.com) is an all-in-one social media management platform that lets you schedule posts, manage your inbox, and view analytics across 14+ platforms — including Twitter/X, Instagram, LinkedIn, Bluesky, Facebook, Threads, TikTok, YouTube, Pinterest, Reddit, and more.

Sign up for Zernio: [https://zernio.link/richard-baker](https://zernio.link/richard-baker) *(affiliate link)*

## Installation

```bash
npm install plugin-zernio
```

Or add to your Paperclip `plugins/package.json`:

```json
{
  "dependencies": {
    "plugin-zernio": "^0.4.0"
  }
}
```

Then run `npm install` in the plugins directory.

## Configuration

The plugin requires a Zernio API key. In the plugin settings, enter either:

- A **secret name** from your project env (e.g. `ZERNIO_API_KEY`) — resolved at runtime via the Paperclip secret provider
- A **raw API key** (e.g. `sk_live_abc123`) — used directly

| Field | Required | Description |
|-------|----------|-------------|
| `zernioApiKey` | Yes | Secret name or raw Zernio API key |
| `defaultProfileId` | No | Default Zernio profile ID for operations |

Get your API key at [zernio.com/dashboard/api-keys](https://zernio.com/dashboard/api-keys).

## Agent Tools

The plugin registers the following tools for Paperclip agents:

### Posts

| Tool | Description |
|------|-------------|
| `zernio-create-post` | Create, schedule, or publish a post |
| `zernio-list-posts` | List posts with optional status filter |
| `zernio-get-post` | Get details of a specific post |
| `zernio-delete-post` | Delete a post |
| `zernio-retry-post` | Retry a failed post |

### Analytics

| Tool | Description |
|------|-------------|
| `zernio-get-analytics` | Get post performance analytics (likes, comments, shares, reach) |
| `zernio-best-times` | Get optimal posting times based on audience engagement |

### Inbox

| Tool | Description |
|------|-------------|
| `zernio-list-accounts` | List connected social media accounts |
| `zernio-list-conversations` | List inbox DM threads |
| `zernio-send-message` | Send a direct message |
| `zernio-list-comments` | List comments across accounts |
| `zernio-reply-comment` | Reply to a comment |

## Webhooks

The plugin can receive Zernio webhook events (`post.published`, `post.failed`, `message.received`, `comment.received`, etc.) and surfaces them as Paperclip plugin events.

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
```

## License

MIT
