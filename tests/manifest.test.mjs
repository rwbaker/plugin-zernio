import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const manifest = (await import('../dist/zernio-manifest.mjs')).default;

describe('manifest', () => {
  it('has required top-level fields', () => {
    assert.equal(manifest.id, 'zernio');
    assert.equal(manifest.apiVersion, 1);
    assert.equal(typeof manifest.version, 'string');
    assert.ok(/^\d+\.\d+\.\d+$/.test(manifest.version), `version "${manifest.version}" is semver`);
    assert.equal(manifest.displayName, 'Zernio');
    assert.equal(typeof manifest.description, 'string');
    assert.equal(manifest.author, 'SGNL Studio');
  });

  it('declares expected capabilities', () => {
    const caps = manifest.capabilities;
    assert.ok(Array.isArray(caps));
    assert.ok(caps.includes('plugin.state.read'));
    assert.ok(caps.includes('plugin.state.write'));
    assert.ok(caps.includes('http.outbound'));
    assert.ok(caps.includes('agent.tools.register'));
    assert.ok(caps.includes('secrets.read-ref'));
  });

  it('has a worker entrypoint', () => {
    assert.equal(manifest.entrypoints.worker, 'dist/worker.mjs');
  });

  describe('instanceConfigSchema', () => {
    const schema = manifest.instanceConfigSchema;

    it('is an object schema', () => {
      assert.equal(schema.type, 'object');
    });

    it('requires zernioApiKey', () => {
      assert.ok(schema.required.includes('zernioApiKey'));
    });

    it('defines zernioApiKey as a string without secret-ref format', () => {
      const prop = schema.properties.zernioApiKey;
      assert.equal(prop.type, 'string');
      assert.equal(prop.format, undefined, 'should not use secret-ref format for visible env key names');
    });

    it('defines optional defaultProfileId', () => {
      const prop = schema.properties.defaultProfileId;
      assert.equal(prop.type, 'string');
      assert.ok(!schema.required.includes('defaultProfileId'));
    });
  });

  describe('webhooks', () => {
    it('declares zernio-events endpoint', () => {
      assert.ok(Array.isArray(manifest.webhooks));
      assert.equal(manifest.webhooks.length, 1);
      assert.equal(manifest.webhooks[0].endpointKey, 'zernio-events');
    });
  });
});
