// Configuration centrale : constantes métier et lecture des variables d'environnement.

const REGIONS = Object.freeze({
    eu: 'Europe',
    na: 'Amérique du Nord',
    ap: 'Asie-Pacifique',
    kr: 'Corée',
    latam: 'Amérique latine',
    br: 'Brésil'
});

const PLATFORMS = Object.freeze({ pc: 'PC', console: 'Console' });

// Identifiant d'URL -> libellé affiché sur l'accueil.
const OVERLAY_STYLES = Object.freeze({
    aura: { label: 'Aura' },
    clean: { label: 'Classique' },
    compact: { label: 'Compact' }
});

const DEFAULTS = Object.freeze({
    port: 3000,
    // Fréquence à laquelle l'overlay interroge NOTRE serveur (gratuit).
    clientRefreshSeconds: 20,
    // Intervalle minimal entre deux appels HenrikDev pour une même ressource.
    // Clé basique = 30 requêtes/min : ~2 ressources × 3 appels/min par joueur.
    minUpstreamIntervalSeconds: 20,
    // Requêtes gardées en réserve sur le quota avant de servir le cache.
    rateLimitReserve: 3,
    // Heure locale à laquelle une nouvelle session commence (évite une coupure à minuit en plein stream).
    sessionResetHour: 6,
    requestTimeoutMs: 10000,
    // La taille de page ne change pas le coût (lu dans la base HenrikDev) : on prend large
    // pour couvrir les longues sessions.
    matchHistorySize: 40
});

function parseInteger(value, fallback, { min = -Infinity, max = Infinity } = {}) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < min || parsed > max) return fallback;
    return parsed;
}

function loadConfig(env = process.env) {
    const apiKey = (env.HENRIKDEV_API_KEY || '').trim();
    if (!apiKey) {
        throw new Error('Clé API manquante : renseigne HENRIKDEV_API_KEY dans le fichier .env (voir .env.example).');
    }

    return Object.freeze({
        apiKey,
        port: parseInteger(env.PORT, DEFAULTS.port, { min: 1, max: 65535 }),
        clientRefreshSeconds: parseInteger(env.REFRESH_SECONDS, DEFAULTS.clientRefreshSeconds, { min: 5, max: 600 }),
        minUpstreamIntervalSeconds: DEFAULTS.minUpstreamIntervalSeconds,
        rateLimitReserve: DEFAULTS.rateLimitReserve,
        sessionResetHour: parseInteger(env.SESSION_RESET_HOUR, DEFAULTS.sessionResetHour, { min: 0, max: 23 }),
        requestTimeoutMs: DEFAULTS.requestTimeoutMs,
        matchHistorySize: DEFAULTS.matchHistorySize,
        isDevelopment: env.NODE_ENV === 'development'
    });
}

module.exports = { REGIONS, PLATFORMS, OVERLAY_STYLES, DEFAULTS, loadConfig, parseInteger };
