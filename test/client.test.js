const test = require('node:test');
const assert = require('node:assert/strict');
const { createHenrikClient, buildUrl } = require('../src/henrik/client');
const { createRateLimiter } = require('../src/henrik/rateLimiter');
const { HenrikApiError } = require('../src/henrik/errors');
const { jsonResponse } = require('./fixtures');

const silent = { error: () => {} };

function setup(responder) {
    const calls = [];
    const rateLimiter = createRateLimiter();
    const fetchImpl = async (url, options) => {
        calls.push({ url: String(url), options });
        return responder(url);
    };
    const client = createHenrikClient({ apiKey: 'HDEV-test', rateLimiter, fetchImpl, logger: silent });
    return { client, calls, rateLimiter };
}

test('buildUrl ignore les paramètres vides', () => {
    const url = buildUrl('https://api.example', '/a', { mode: 'competitive', size: 20, map: undefined, x: null });
    assert.equal(url.toString(), 'https://api.example/a?mode=competitive&size=20');
});

test('envoie la clé dans l’en-tête et renvoie le TTL du cache HenrikDev', async () => {
    const { client, calls, rateLimiter } = setup(() => jsonResponse({ data: [1] }, {
        headerValues: { 'x-cache-status': 'HIT', 'x-cache-ttl': 280, 'x-ratelimit-remaining': 20, 'x-ratelimit-reset': 40 }
    }));

    const result = await client.get('/valorant/v1/x', { size: 5 });

    assert.deepEqual(result, { body: { data: [1] }, cacheTtlSeconds: 280 });
    assert.equal(calls[0].options.headers.Authorization, 'HDEV-test');
    assert.match(calls[0].url, /\/valorant\/v1\/x\?size=5$/);
    assert.equal(rateLimiter.snapshot().remaining, 20);
});

test('cache MISS => TTL 0', async () => {
    const { client } = setup(() => jsonResponse({ data: {} }, { headerValues: { 'x-cache-status': 'MISS' } }));
    assert.equal((await client.get('/a')).cacheTtlSeconds, 0);
});

test('transforme une erreur API en HenrikApiError avec son code', async () => {
    const { client } = setup(() => jsonResponse({ errors: [{ code: 22, message: 'Account not found', status: 404 }] }, { status: 404 }));
    await assert.rejects(client.get('/a'), (error) => {
        assert.ok(error instanceof HenrikApiError);
        assert.equal(error.status, 404);
        assert.equal(error.code, 22);
        return true;
    });
});

test('un 429 bloque les appels suivants sans toucher le réseau', async () => {
    const { client, calls } = setup(() => jsonResponse(null, { status: 429, headerValues: { 'x-ratelimit-reset': 9 } }));

    await assert.rejects(client.get('/a'), (error) => error.status === 429 && error.retryAfterSeconds === 9 && error.message === 'HTTP 429');
    await assert.rejects(client.get('/a'), (error) => error.code === 'LOCAL_RESERVE' && error.retryAfterSeconds === 9);
    assert.equal(calls.length, 1);
});

test('une panne réseau devient une HenrikApiError de statut 0', async () => {
    const { client } = setup(() => { throw new Error('ECONNRESET'); });
    await assert.rejects(client.get('/a'), (error) => error.status === 0 && error.code === 'NETWORK');
});

test('un corps illisible n’empêche pas de remonter le statut', async () => {
    const { client } = setup(() => ({ ok: false, status: 500, headers: { get: () => null }, json: async () => { throw new Error('html'); } }));
    await assert.rejects(client.get('/a'), (error) => error.status === 500 && error.code === null);
});
