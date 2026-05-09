const manifest = {
  id: 'zernio',
  apiVersion: 1 as const,
  version: '0.2.0',
  displayName: 'Zernio',
  description:
    'Social media management via the Zernio API — schedule posts, manage inbox, and view analytics across 14+ platforms.',
  author: 'SGNL Studio',
  categories: ['automation'] as const,

  capabilities: [
    'plugin.state.read',
    'plugin.state.write',
    'http.outbound',
    'agent.tools.register',
    'webhooks.receive',
  ] as const,

  entrypoints: {
    worker: 'dist/worker.mjs',
  },

  instanceConfigSchema: {
    type: 'object',
    properties: {
      zernioApiKey: {
        type: 'string',
        title: 'Zernio API Key',
        description: 'Your Zernio API key (starts with sk_).',
      },
      defaultProfileId: {
        type: 'string',
        title: 'Default Profile ID',
        description: 'Optional default Zernio profile ID for operations.',
      },
    },
    required: ['zernioApiKey'],
  },

  webhooks: [
    {
      endpointKey: 'zernio-events',
      displayName: 'Zernio Events',
      description:
        'Receives webhook events from Zernio (post.published, post.failed, message.received, etc.).',
    },
  ],
};

export default manifest;
