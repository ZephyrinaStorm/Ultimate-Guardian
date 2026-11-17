# Ultimate Guardian

A Discord security bot and public website. Configure the bot through slash commands. No dashboard, login, subscription tiers, or fabricated server statistics.

## What is included

- **Moderation:** ban, kick, warn, timeout, remove timeout, unban, message purge, persisted moderation cases and staff logging.
- **Protection:** configurable anti-link, anti-spam, anti-raid lockdown, audit-based anti-nuke response, anti-scam, account-age enforcement, possible-alt review alerts, and unauthorized-new-webhook removal.
- **Blacklists:** words/phrases, domains including subdomains, and user IDs. Blacklisted users’ messages are removed; future joins are kicked when permissions permit. Existing users are not immediately kicked.
- **Private support:** ticket channels, support role/category configuration, claim, close, and private text transcripts of up to 500 recent messages.
- **Backups:** role/channel/overwrite snapshots, list, download, delete, and additive restoration of missing objects. Restore retries retain ID mappings to avoid duplicating successfully recreated objects.
- **Public website:** home, features, searchable commands, setup, status, support, privacy, terms, and an unknown-page view. Responsive CSS, keyboard focus, and no external frontend dependencies.
- **Data tools:** per-server SQLite storage, owner reset, staff export of configuration/recent cases/latest backups, and consistent operator database backup script.

There are **14 slash command groups and 40 command actions**. Website command documentation is generated from the actual command definitions.

## Quick start

Use **Node.js 24**. Node's bundled SQLite module supplies storage without a separate database service.

1. Create an application at https://discord.com/developers/applications and add a bot.
2. Enable **Server Members Intent** and **Message Content Intent** on the Bot page. The bot also requests the non-privileged Guild Moderation intent.
3. From the project root, copy `.env.example` to `.env`. Set `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID`. Never commit or share `.env`.
4. Run:

```bash
npm ci
npm run deploy
npm start
```

Open http://localhost:3000 for the website. `npm start` calls the root `index.js`; there is no `src/src/index.js` path.

Commands register globally for every server where the bot is installed. Run `npm run deploy` after replacing an older version to remove its obsolete commands from the global scope. Previously registered guild commands must be cleared separately; global registration does not remove them.

The website invite button uses `DISCORD_CLIENT_ID` automatically when served alongside the bot. The OAuth invite requests the individual permissions the tools need and does not request Administrator.

### Initial Discord configuration

```text
/config logs channel:#staff-logs
/config tickets role:@Support category:Support
/protection anti-spam enabled:true
/protection anti-scam enabled:true
/protection status
/help
```

All protection modules start **disabled**. Blacklist entries are enforced when present independently of the module switches. Administrators bypass message filters. The guild owner, the bot itself, and explicitly trusted users bypass audit-based anti-nuke and webhook protection.

Place the bot role above members it should moderate. Ensure it can view and send in its logging and ticket channels. Do not grant server-wide View Channel permission to ordinary roles through ticket-specific overwrites.

| Capability | Bot permissions |
| --- | --- |
| General responses | View Channels, Send Messages, Embed Links |
| Transcripts/backups | Read Message History, Attach Files |
| Ban / kick / timeout | Ban Members / Kick Members / Moderate Members |
| Message deletion | Manage Messages |
| Ticket creation and lockdown overwrites | Manage Channels, Manage Roles |
| Structure restore | Manage Channels, Manage Roles |
| Audit protections | View Audit Log, Manage Roles, Manage Webhooks |

Commands check caller permissions at runtime as well as declaring their default Discord permission. Member actions check the caller's role order. Bot role order and Discord's own permission checks still apply. Discord command visibility overrides do not bypass these runtime checks.

## Protection behavior and limits

- **Anti-spam:** at least `spamThreshold` checked messages in 5 seconds deletes the triggering member message and applies a 60-second timeout when possible. It does not bulk-delete other members' messages.
- **Anti-link:** blocks HTTP(S), www, and Discord invitation links. It is a pattern filter, not a URL reputation service.
- **Anti-scam:** local reward-bait and credential-request rules. Messages are checked locally without external model requests.
- **Anti-raid:** at least `raidThreshold` joins in 10 seconds denies @everyone Send Messages on text/announcement channels. Explicit role/member allows may still permit sending; voice/threads are not covered. This is a response to joins, not an admission gate. Staff must unlock manually with `/lockdown enabled:false`.
- **Anti-nuke:** three recent audited channel deletes, role deletes, or bans by one untrusted actor in 10 seconds attempts to remove their editable roles granting administrative capabilities. It reacts after events and cannot prevent the first destructive actions. Audit-log delay, member fetch failures, managed roles, server-owner immunity, role hierarchy, or direct member overwrites may limit it. It does not recreate deleted objects automatically.
- **Anti-webhook:** removes new webhooks tied to recent audit entries from untrusted actors. It does not delete all existing webhooks or inspect webhook messages. Trust authorized creators with `/config trust` before enabling it.
- **Anti-new-account:** kicks joining users younger than the configured account age when permitted.
- **Anti-alt:** flags accounts younger than 30 days without a custom avatar for human review. Discord does not expose IP/device identity; this feature does not prove alternate-account ownership or automatically kick suspected alts.
- Tune spam (3–30 messages/5s), raid (3–50 joins/10s), and account age (1–365 days) using `/protection thresholds`.

For best coverage test each protection in a private server before enabling it for your community. These tools supplement human moderation.

## Tickets

One open ticket per member and at most 100 open tickets per server. A configured support role and category are required. Openers, the bot, support staff, and server administrators have access. Tickets do not inherit the category's permission overwrites: explicit private overwrites are created.

`/ticket close` removes the opener's access; it does not delete the channel. Staff can claim or export transcripts, then manually delete channels when appropriate. Transcript exports include up to 500 recent messages, available text, and attachment URLs. They do not download attachment files. Closed ticket metadata remains until server data is reset or removed.

## Backups and data

`/backup create` captures supported channel types, roles, and permission overwrites. Use `/backup download` to keep an independent JSON copy. Maximum 20 stored snapshots per server; delete old snapshots before creating more.

`/backup restore id:<uuid> confirm:RESTORE` recreates **missing objects only in the originating server**. It preserves existing objects. A saved ID mapping supports retries. Failed role resolution causes dependent channels to be skipped rather than dropping permission overwrites. Review every restore result.

Not included: messages, files, members/member role assignments, invites, integrations, webhook credentials, emojis/stickers, complete forum configuration, or full server settings. Role positions require manual review. JSON downloads are archival exports; importing arbitrary JSON or cloning another guild is not implemented.

Records are stored under `DATA_DIR/guardbot.sqlite` (default `./data`). SQLite uses WAL. Run one bot process per data directory; this is not a sharded or multi-instance deployment.

For a consistent database copy while the bot is running:

```bash
npm run backup-data -- /absolute/path/guardbot-backup.sqlite
```

Copy that backup to an independent safe location. To restore the database, stop the bot, preserve the current database plus its `-wal` and `-shm` files elsewhere, put the consistent backup at `DATA_DIR/guardbot.sqlite`, remove any obsolete WAL/SHM sidecars from the active directory, and restart. Server-structure JSON snapshots are different from the bot database backup.

`/config export` exports settings, the latest 20 cases within the recent 500-case window, and up to 20 backups. The operator's database backup includes complete stored history. `/config reset confirm:DELETE` is owner-only and deletes this server's stored data after open tickets are closed and lockdown is reversed. It does not delete Discord channels, logs, transcripts, independent backups. Guild removal events delete stored guild data; removals while offline may require operator cleanup. There is no automatic age-based retention job. Operators must set an appropriate retention practice and monitor disk usage.

## Public website

The bot starts the website on `PORT` (default 3000), bound to `0.0.0.0`.

```bash
npm run website    # website-only preview; bot status is unknown
npm run build      # regenerate website/commands.json after command changes
```

The website can be hosted independently on DreamHost or another static host: upload only the contents of `website/` into the public directory. In `website/config.js`, set the **public** `clientId`, `supportUrl`, and set `statusUrl: ''` unless a compatible endpoint is available. Never upload `.env`, bot code, database files, or API keys into a public web directory. Static hosting needs no Node runtime or OAuth callback.

The bundled server serves only a fixed public asset allowlist. `/api/config` exposes only the public application ID and support URL. `/api/status` exposes connected state, latency, and uptime, without guild/member records. `/healthz` checks the website process and reports the bot's connection separately. A website-only copy shows bot status as unavailable, never a fabricated online value. Routes use URL fragments, so refreshes work without host rewrites.

Privacy and terms pages describe this implementation and are editable operator text. Before publishing, provide a real private contact route and review retention disclosures for your deployment. No login or dashboard is included.

## Render hosting

Use a **Node Web Service** pointing at the repository root:

| Setting | Value |
| --- | --- |
| Node version | 24 (also specified in `.node-version`) |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check | `/healthz` |
| Persistent disk mount | `/var/data` |
| DATA_DIR | `/var/data` |
| Required environment variables | DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID |

Persistent disks require a paid compatible service. Review current plan and disk charges before creating a service. Only files below the mount path persist; a disk-backed service uses a single instance and has an interruption during redeploys. This project does not create or charge for hosting automatically.

Run `npm run deploy` once locally with the same bot credentials, or in the service shell, after deployment and whenever slash command definitions change. Setting `SUPPORT_URL` customizes the site. Do not put secrets in GitHub. No Discord OAuth callback URL is needed because this website does not log users in.

Current platform references: https://render.com/docs/disks and https://render.com/docs/configure-environment-variables.

## Validation

```bash
npm run check
npm test
```

Tests cover isolation/persistence, filter behavior, duration parsing, role hierarchy, runtime moderation authorization, warning persistence with failed DMs, and the public server's asset boundary. Discord gateway delivery, actual guild permissions, audit timing require a live test server and credentials.

## Project layout

- `index.js`: simple deployment entry point.
- `bot/commands/`: moderation, settings, tickets, backup, and information commands.
- `bot/protection.js`: passive filters and event responses.
- `bot/store.js`: SQLite persistence.
- `website/`: portable public website.
- `test/`: credential-free verification.

Based on ZephyrinaStorm/Ultimate-Guardian at commit c75b41b77d8752f898f0af62b71fa6e4c70212cc. This edition removes conversation summaries, external model scam checks, their configuration, and related documentation. Rule-based scam protection remains available.
