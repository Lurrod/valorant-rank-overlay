// Client HTTP minimal pour l'API HenrikDev (https://docs.henrikdev.xyz).

const { HenrikApiError } = require('./errors');
const { readNumberHeader } = require('./rateLimiter');

const BASE_URL = 'https://api.henrikdev.xyz';

function buildUrl(baseUrl, path, query = {}) {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    return url;
}

function createHenrikClient({ apiKey, rateLimiter, fetchImpl = globalThis.fetch, baseUrl = BASE_URL, timeoutMs = 10000, logger = console }) {
    async function send(url) {
        try {
            return await fetchImpl(url, {
                headers: { Authorization: apiKey, Accept: 'application/json' },
                signal: AbortSignal.timeout(timeoutMs)
            });
        } catch (error) {
            logger.error(`[henrik] ${url.pathname} injoignable :`, error.message);
            throw new HenrikApiError({ status: 0, code: 'NETWORK', message: error.message });
        }
    }

    // Renvoie { body, cacheTtlSeconds } ; cacheTtlSeconds > 0 quand HenrikDev a servi son propre cache.
    async function get(path, query) {
        if (!rateLimiter.canRequest()) {
            throw new HenrikApiError({
                status: 429,
                code: 'LOCAL_RESERVE',
                message: 'Quota local réservé, requête différée.',
                retryAfterSeconds: rateLimiter.retryInSeconds()
            });
        }

        const url = buildUrl(baseUrl, path, query);
        const response = await send(url);
        rateLimiter.record(response.headers);
        const body = await response.json().catch(() => null);

        if (!response.ok) {
            const apiError = body?.errors?.[0];
            const retryAfterSeconds = readNumberHeader(response.headers, 'retry-after')
                ?? readNumberHeader(response.headers, 'x-ratelimit-reset');
            if (response.status === 429) rateLimiter.block(retryAfterSeconds);
            logger.error(`[henrik] ${url.pathname} -> ${response.status} (${apiError?.code ?? '?'}) ${apiError?.message ?? ''}`);
            throw new HenrikApiError({
                status: response.status,
                code: apiError?.code ?? null,
                message: apiError?.message || `HTTP ${response.status}`,
                retryAfterSeconds
            });
        }

        const cacheHit = (response.headers.get('x-cache-status') || '').toUpperCase() === 'HIT';
        return {
            body,
            cacheTtlSeconds: cacheHit ? readNumberHeader(response.headers, 'x-cache-ttl') ?? 0 : 0
        };
    }

    return { get };
}

module.exports = { createHenrikClient, buildUrl, BASE_URL };
