const test = require('node:test');
const assert = require('node:assert/strict');
const { HenrikApiError, toUserMessage, toHttpStatus } = require('../src/henrik/errors');
const { loadConfig, parseInteger, DEFAULTS } = require('../src/config');

const apiError = (status, extra = {}) => new HenrikApiError({ status, message: 'x', ...extra });

test('toUserMessage traduit les codes et statuts HenrikDev', () => {
    assert.match(toUserMessage(apiError(404, { code: 22 })), /Compte introuvable/);
    assert.match(toUserMessage(apiError(404, { code: 25 })), /Aucune donnée de classé/);
    assert.match(toUserMessage(apiError(404)), /Joueur introuvable/);
    assert.match(toUserMessage(apiError(403)), /Clé API/);
    assert.match(toUserMessage(apiError(401)), /Clé API/);
    assert.match(toUserMessage(apiError(429, { retryAfterSeconds: 12 })), /12 s/);
    assert.match(toUserMessage(apiError(429)), /sous peu/);
    assert.match(toUserMessage(apiError(0)), /injoignable/);
    assert.match(toUserMessage(apiError(503)), /rencontre un problème/);
    assert.match(toUserMessage(apiError(400)), /refusée/);
    assert.match(toUserMessage(new Error('x')), /inattendue/);
});

test('toHttpStatus conserve 400/404/429 et masque le reste en 502', () => {
    assert.equal(toHttpStatus(apiError(404)), 404);
    assert.equal(toHttpStatus(apiError(429)), 429);
    assert.equal(toHttpStatus(apiError(400)), 400);
    assert.equal(toHttpStatus(apiError(403)), 502);
    assert.equal(toHttpStatus(apiError(0)), 502);
    assert.equal(toHttpStatus(new Error('x')), 500);
});

test('loadConfig exige la clé API', () => {
    assert.throws(() => loadConfig({}), /HENRIKDEV_API_KEY/);
    assert.throws(() => loadConfig({ HENRIKDEV_API_KEY: '   ' }), /HENRIKDEV_API_KEY/);
});

test('loadConfig applique les valeurs par défaut et les surcharges valides', () => {
    const defaults = loadConfig({ HENRIKDEV_API_KEY: 'k' });
    assert.equal(defaults.clientRefreshSeconds, DEFAULTS.clientRefreshSeconds);
    assert.equal(defaults.port, 3000);
    assert.equal(defaults.isDevelopment, false);

    const custom = loadConfig({ HENRIKDEV_API_KEY: 'k', PORT: '4000', REFRESH_SECONDS: '30', SESSION_RESET_HOUR: '0', NODE_ENV: 'development' });
    assert.deepEqual([custom.port, custom.clientRefreshSeconds, custom.sessionResetHour, custom.isDevelopment], [4000, 30, 0, true]);

    const invalid = loadConfig({ HENRIKDEV_API_KEY: 'k', REFRESH_SECONDS: '1', SESSION_RESET_HOUR: '30', PORT: 'abc' });
    assert.deepEqual([invalid.clientRefreshSeconds, invalid.sessionResetHour, invalid.port], [20, 6, 3000]);
});

test('parseInteger respecte les bornes', () => {
    assert.equal(parseInteger('5', 1, { min: 0, max: 10 }), 5);
    assert.equal(parseInteger('11', 1, { min: 0, max: 10 }), 1);
    assert.equal(parseInteger(undefined, 7), 7);
});
