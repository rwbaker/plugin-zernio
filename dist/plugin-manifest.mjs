import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// src/manifest.ts
var manifest = {
  id: "zernio",
  apiVersion: 1,
  version: "0.2.0",
  displayName: "Zernio",
  description: "Social media management via the Zernio API \u2014 schedule posts, manage inbox, and view analytics across 14+ platforms.",
  author: "SGNL Studio",
  categories: ["automation"],
  capabilities: [
    "plugin.state.read",
    "plugin.state.write",
    "http.outbound",
    "agent.tools.register",
    "webhooks.receive"
  ],
  entrypoints: {
    worker: "dist/worker.mjs"
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      zernioApiKey: {
        type: "string",
        title: "Zernio API Key",
        description: "Your Zernio API key (starts with sk_)."
      },
      defaultProfileId: {
        type: "string",
        title: "Default Profile ID",
        description: "Optional default Zernio profile ID for operations."
      }
    },
    required: ["zernioApiKey"]
  },
  webhooks: [
    {
      endpointKey: "zernio-events",
      displayName: "Zernio Events",
      description: "Receives webhook events from Zernio (post.published, post.failed, message.received, etc.)."
    }
  ]
};
var manifest_default = manifest;
export {
  manifest_default as default
};
//# sourceMappingURL=plugin-manifest.mjs.map
