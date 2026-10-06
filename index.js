// Point d'entrée : charge la configuration, assemble les services et démarre le serveur.

require('dotenv').config({ quiet: true });

const { loadConfig } = require('./src/config');
const { createRateLimiter } = require('./src/henrik/rateLimiter');
const { createHenrikClient } = require('./src/henrik/client');
const { createCache } = require('./src/cache');
const { createStatsService } = require('./src/stats/playerStats');
const { createApp } = require('./src/app');

function start() {
    let config;
    try {
        config = loadConfig();
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }

    const rateLimiter = createRateLimiter({ reserve: config.rateLimitReserve });
    const client = createHenrikClient({ apiKey: config.apiKey, rateLimiter, timeoutMs: config.requestTimeoutMs });
    const statsService = createStatsService({ client, cache: createCache(), config });
    const app = createApp({ statsService, rateLimiter, config });

    app.listen(config.port, () => {
        console.log(`Serveur d'overlays Valorant : http://localhost:${config.port}`);
        console.log(`Rafraîchissement des overlays toutes les ${config.clientRefreshSeconds} s (quota HenrikDev protégé par cache).`);
    });
}

start();
