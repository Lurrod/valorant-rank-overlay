// Fabrique de l'application Express (séparée du démarrage pour pouvoir la tester).

const path = require('path');
const express = require('express');
const { REGIONS, PLATFORMS, OVERLAY_STYLES } = require('./config');
const { createOverlayRouter } = require('./routes/overlays');

const ROOT = path.join(__dirname, '..');

function createApp({ statsService, rateLimiter, config, logger = console }) {
    const app = express();
    const routeConfig = { ...config, styles: OVERLAY_STYLES };

    app.disable('x-powered-by');
    app.set('view engine', 'ejs');
    app.set('views', path.join(ROOT, 'views'));
    // Version des fichiers statiques : change à chaque démarrage, ce qui force le navigateur
    // (et OBS) à recharger CSS et JS après une mise à jour au lieu d'utiliser son cache.
    app.locals.assetVersion = Date.now().toString(36);
    app.use(express.static(path.join(ROOT, 'public'), {
        setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache')
    }));

    app.get('/', (req, res) => {
        res.render('home', {
            styles: OVERLAY_STYLES,
            regions: REGIONS,
            platforms: PLATFORMS,
            refreshSeconds: config.clientRefreshSeconds,
            sessionResetHour: config.sessionResetHour
        });
    });

    // Diagnostic : état du quota HenrikDev tel que vu par le serveur.
    app.get('/api/quota', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.json({ success: true, data: rateLimiter.snapshot(), error: null });
    });

    app.use(createOverlayRouter({ statsService, config: routeConfig, logger }));

    app.use((req, res) => {
        res.status(404).json({ success: false, data: null, error: 'Page introuvable.' });
    });

    return app;
}

module.exports = { createApp };
