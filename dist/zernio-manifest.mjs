// src/manifest.ts
var manifest = {
  id: "zernio",
  apiVersion: 1,
  version: "0.4.1",
  displayName: "Zernio",
  description: "Social media management via the Zernio API \u2014 schedule posts, manage inbox, and view analytics across 14+ platforms.",
  author: "SGNL Studio",
  categories: ["automation"],
  capabilities: [
    "plugin.state.read",
    "plugin.state.write",
    "http.outbound",
    "agent.tools.register",
    "webhooks.receive",
    "secrets.read-ref"
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
        description: "Enter a secret name from project env (e.g. ZERNIO_API_KEY) or paste a raw API key (sk_\u2026). Secret names are resolved at runtime."
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
//# sourceMappingURL=manifest.mjs.map
