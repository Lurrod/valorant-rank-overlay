const test = require('node:test');
const assert = require('node:assert/strict');
const { createCache } = require('../src/cache');

function clock() {
    let time = 0;
    return { now: () => time, advance: (ms) => { time += ms; } };
}

test('sert la valeur en cache jusqu’à expiration', async () => {
    const time = clock();
    const cache = createCache({ now: time.now });
    let calls = 0;
    const loader = async () => ({ value: ++calls, ttlMs: 1000 });

    assert.equal((await cache.get('k', loader)).value, 1);
    time.advance(999);
    assert.equal((await cache.get('k', loader)).value, 1);
    time.advance(1);
    assert.equal((await cache.get('k', loader)).value, 2);
});

test('dédoublonne les chargements simultanés', async () => {
    const cache = createCache();
    let calls = 0;
    const loader = async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { value: 'ok', ttlMs: 1000 };
    };

    const results = await Promise.all([cache.get('k', loader), cache.get('k', loader), cache.get('k', loader)]);
    assert.equal(calls, 1);
    assert.deepEqual(results.map((result) => result.value), ['ok', 'ok', 'ok']);
});

test('renvoie l’ancienne valeur (stale) en cas d’erreur puis attend avant de réessayer', async () => {
    const time = clock();
    const cache = createCache({ now: time.now, errorBackoffMs: 5000 });
    await cache.get('k', async () => ({ value: 'ancien', ttlMs: 10 }));
    time.advance(10);

    const failure = Object.assign(new Error('429'), { retryAfterSeconds: 7 });
    const stale = await cache.get('k', async () => { throw failure; });
    assert.equal(stale.value, 'ancien');
    assert.equal(stale.stale, true);
    assert.equal(stale.error, failure);

    let retried = false;
    time.advance(6_999);
    await cache.get('k', async () => { retried = true; return { value: 'neuf', ttlMs: 10 }; });
    assert.equal(retried, false);

    time.advance(1);
    assert.equal((await cache.get('k', async () => ({ value: 'neuf', ttlMs: 10 }))).value, 'neuf');
});

test('utilise le délai par défaut si l’erreur n’en donne pas', async () => {
    const time = clock();
    const cache = createCache({ now: time.now, errorBackoffMs: 100 });
    await cache.get('k', async () => ({ value: 'a', ttlMs: 0 }));
    await cache.get('k', async () => { throw new Error('boom'); });
    time.advance(99);
    assert.equal((await cache.get('k', async () => ({ value: 'b', ttlMs: 0 }))).value, 'a');
});

test('propage l’erreur quand aucune valeur n’est connue', async () => {
    const cache = createCache();
    await assert.rejects(cache.get('k', async () => { throw new Error('boom'); }), /boom/);
});

test('limite le nombre d’entrées en évinçant la plus ancienne', async () => {
    const cache = createCache({ maxEntries: 2 });
    for (const key of ['a', 'b', 'c']) await cache.get(key, async () => ({ value: key, ttlMs: 1000 }));
    assert.equal(cache.size(), 2);
});
