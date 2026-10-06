const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter, readNumberHeader } = require('../src/henrik/rateLimiter');
const { headers } = require('./fixtures');

function clock(start = 0) {
    let time = start;
    return { now: () => time, advance: (ms) => { time += ms; } };
}

test('autorise les requêtes tant qu’aucun quota n’est connu', () => {
    const limiter = createRateLimiter({ now: clock().now });
    assert.equal(limiter.canRequest(), true);
    assert.equal(limiter.retryInSeconds(), 0);
});

test('garde une réserve sur le quota puis libère à la réinitialisation', () => {
    const time = clock();
    const limiter = createRateLimiter({ reserve: 3, now: time.now });

    limiter.record(headers({ 'x-ratelimit-remaining': 10, 'x-ratelimit-reset': 30, 'x-ratelimit-limit': 30 }));
    assert.equal(limiter.canRequest(), true);

    limiter.record(headers({ 'x-ratelimit-remaining': 3, 'x-ratelimit-reset': 30 }));
    assert.equal(limiter.canRequest(), false);
    assert.equal(limiter.retryInSeconds(), 30);
    assert.deepEqual(limiter.snapshot(), { limit: 30, remaining: 3, resetInSeconds: 30, blocked: true, retryInSeconds: 30 });

    time.advance(30_000);
    assert.equal(limiter.canRequest(), true);
    assert.equal(limiter.snapshot().remaining, 30);
});

test('bloque après un 429 pendant la durée indiquée', () => {
    const time = clock();
    const limiter = createRateLimiter({ now: time.now });
    limiter.block(7);
    assert.equal(limiter.canRequest(), false);
    assert.equal(limiter.retryInSeconds(), 7);
    time.advance(7_000);
    assert.equal(limiter.canRequest(), true);
});

test('après un 429, /api/quota ne prétend pas que le quota est plein pendant le blocage', () => {
    const time = clock();
    const limiter = createRateLimiter({ now: time.now });
    limiter.record(headers({ 'x-ratelimit-remaining': 10, 'x-ratelimit-reset': 5, 'x-ratelimit-limit': 30 }));
    limiter.block(30);
    time.advance(10_000);
    assert.deepEqual(limiter.snapshot(), { limit: 30, remaining: 0, resetInSeconds: 20, blocked: true, retryInSeconds: 20 });
});

test('bloque 60 s par défaut si la durée est inconnue', () => {
    const time = clock();
    const limiter = createRateLimiter({ now: time.now });
    limiter.block(null);
    assert.equal(limiter.retryInSeconds(), 60);
});

test('ignore les réponses sans en-têtes de quota', () => {
    const limiter = createRateLimiter({ now: clock().now });
    limiter.record(headers({}));
    limiter.record(undefined);
    assert.equal(limiter.snapshot().remaining, null);
});

test('readNumberHeader rejette les valeurs non numériques', () => {
    assert.equal(readNumberHeader(headers({ a: 'abc' }), 'a'), null);
    assert.equal(readNumberHeader(headers({ a: '' }), 'a'), null);
    assert.equal(readNumberHeader(headers({ a: '12' }), 'a'), 12);
});
