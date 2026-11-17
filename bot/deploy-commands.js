require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./load-commands');

async function deploy({
  token = process.env.DISCORD_BOT_TOKEN,
  clientId = process.env.DISCORD_CLIENT_ID,
  rest,
} = {}) {
  if (!token || !/^\d{17,20}$/.test(clientId || '')) {
    throw new Error('Set DISCORD_BOT_TOKEN and a valid DISCORD_CLIENT_ID.');
  }
  const api = rest || new REST({ version: '10' }).setToken(token);
  // Always register globally, even if an old DISCORD_GUILD_ID is still configured.
  // Global registration makes commands available in all servers where the bot is installed.
  const result = await api.put(Routes.applicationCommands(clientId), {
    body: loadCommands().map(command => command.data.setDMPermission(false).toJSON()),
  });
  console.log(`Registered ${result.length} slash command groups globally for all servers.`);
  return result;
}

if (require.main === module) {
  deploy().catch(error => {
    console.error('Command registration failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { deploy };
