const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deploy } = require('../bot/deploy-commands');

test('global registration replaces old commands without model tools', async () => {
  let request;
  await deploy({
    token: 'test-token',
    clientId: '123456789012345678',
    rest: { put: async (route, payload) => {
      request = { route, body: payload.body };
      return payload.body;
    } },
  });
  assert.equal(request.route, '/applications/123456789012345678/commands');
  assert.equal(request.body.length, 14);
  assert.ok(!request.body.some(command => command.name === 'summarize'));
  const config = request.body.find(command => command.name === 'config');
  assert.ok(!config.options.some(option => option.name === 'ai'));
  const protections = request.body.find(command => command.name === 'protection');
  assert.ok(protections.options.some(option => option.name === 'anti-scam'));
});

test('protection event handlers load without optional modules', () => {
  const { EventEmitter } = require('node:events');
  const { Events } = require('discord.js');
  const { installProtection } = require('../bot/protection');
  const client = new EventEmitter();
  const dispose = installProtection(client);
  try {
    assert.equal(client.listenerCount(Events.MessageCreate), 1);
    assert.equal(client.listenerCount(Events.MessageUpdate), 1);
    assert.equal(client.listenerCount(Events.GuildMemberAdd), 1);
  } finally { dispose(); }
});
