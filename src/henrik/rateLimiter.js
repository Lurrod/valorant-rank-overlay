// Suit le quota HenrikDev à partir des en-têtes de réponse pour ne jamais déclencher de 429.
// Le quota compte aussi les requêtes Riot faites en arrière-plan : on se fie donc aux en-têtes,
// pas à notre propre comptage.

function readNumberHeader(headers, name) {
    const raw = headers?.get?.(name);
    if (raw === null || raw === undefined || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

function createRateLimiter({ reserve = 3, now = Date.now } = {}) {
    let state = { limit: null, remaining: null, resetAt: 0, blockedUntil: 0 };

    function windowActive() {
        return now() < state.resetAt;
    }

    function retryInSeconds() {
        const until = Math.max(state.blockedUntil, windowActive() ? state.resetAt : 0);
        return Math.max(0, Math.ceil((until - now()) / 1000));
    }

    function canRequest() {
        if (now() < state.blockedUntil) return false;
        if (state.remaining !== null && windowActive() && state.remaining <= reserve) return false;
        return true;
    }

    function record(headers) {
        const remaining = readNumberHeader(headers, 'x-ratelimit-remaining');
        const resetSeconds = readNumberHeader(headers, 'x-ratelimit-reset');
        const limit = readNumberHeader(headers, 'x-ratelimit-limit');
        if (remaining === null) return;
        state = {
            ...state,
            limit: limit ?? state.limit,
            remaining,
            resetAt: now() + (resetSeconds ?? 60) * 1000
        };
    }

    function block(seconds) {
        const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
        const blockedUntil = now() + safeSeconds * 1000;
        state = { ...state, remaining: 0, blockedUntil, resetAt: Math.max(state.resetAt, blockedUntil) };
    }

    function snapshot() {
        return {
            limit: state.limit,
            remaining: windowActive() ? state.remaining : state.limit,
            resetInSeconds: windowActive() ? Math.ceil((state.resetAt - now()) / 1000) : 0,
            blocked: !canRequest(),
            retryInSeconds: canRequest() ? 0 : retryInSeconds()
        };
    }

    return { canRequest, record, block, retryInSeconds, snapshot };
}

module.exports = { createRateLimiter, readNumberHeader };
