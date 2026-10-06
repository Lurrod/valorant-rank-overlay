// Cache mémoire à durée de vie variable, avec dédoublonnage des requêtes en cours
// et repli sur la dernière valeur connue quand l'API échoue (l'overlay ne se vide jamais).

const DEFAULT_ERROR_BACKOFF_MS = 20000;

function createCache({ now = Date.now, maxEntries = 200, errorBackoffMs = DEFAULT_ERROR_BACKOFF_MS } = {}) {
    const entries = new Map();
    const inflight = new Map();

    function store(key, entry) {
        entries.delete(key);
        entries.set(key, entry);
        if (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    }

    async function load(key, loader) {
        try {
            const { value, ttlMs } = await loader();
            const fetchedAt = now();
            store(key, { value, fetchedAt, expiresAt: fetchedAt + ttlMs });
            return { value, fetchedAt, stale: false, error: null };
        } catch (error) {
            const previous = entries.get(key);
            if (!previous) throw error;
            // On garde l'ancienne valeur et on attend avant de réessayer.
            const backoffMs = error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : errorBackoffMs;
            store(key, { ...previous, expiresAt: now() + backoffMs });
            return { value: previous.value, fetchedAt: previous.fetchedAt, stale: true, error };
        }
    }

    // loader : () => Promise<{ value, ttlMs }>
    function get(key, loader) {
        const entry = entries.get(key);
        if (entry && now() < entry.expiresAt) {
            return Promise.resolve({ value: entry.value, fetchedAt: entry.fetchedAt, stale: false, error: null });
        }
        if (!inflight.has(key)) {
            inflight.set(key, load(key, loader).finally(() => inflight.delete(key)));
        }
        return inflight.get(key);
    }

    return { get, size: () => entries.size };
}

module.exports = { createCache };
