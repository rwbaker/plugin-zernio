# plugin-zernio

Paperclip plugin for the [Zernio](https://zernio.com) social media management API.

Manage posts, accounts, analytics, inbox conversations, and webhooks across 14+ social platforms from within Paperclip.

## Installation

Add to your Paperclip `plugins/package.json`:

```json
{
  "dependencies": {
    "plugin-zernio": "github:rwbaker/plugin-zernio"
  }
}
```

Then run `npm install` in the plugins directory.

## Configuration

The plugin requires a Zernio API key. Set it in the plugin instance configuration:

| Field | Required | Description |
|-------|----------|-------------|
| `zernioApiKey` | Yes | Your Zernio API key (`sk_...`) |
| `defaultProfileId` | No | Default Zernio profile ID for operations |

Get your API key at [zernio.com/dashboard/api-keys](https://zernio.com/dashboard/api-keys).

## Agent Tools

The plugin registers the following tools for Paperclip agents:

| Tool | Description |
|------|-------------|
| `zernio-list-accounts` | List connected social media accounts |
| `zernio-create-post` | Create, schedule, or publish a post |
| `zernio-list-posts` | List posts with status filters |
| `zernio-get-post` | Get details of a specific post |
| `zernio-delete-post` | Delete a post |
| `zernio-retry-post` | Retry a failed post |
| `zernio-get-analytics` | Get post performance analytics |
| `zernio-best-times` | Get optimal posting times |
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
```

## License

MIT
