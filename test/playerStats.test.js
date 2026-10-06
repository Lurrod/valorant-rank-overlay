const test = require('node:test');
const assert = require('node:assert/strict');
const { createStatsService, playerKey } = require('../src/stats/playerStats');
const { createCache } = require('../src/cache');
const { HenrikApiError } = require('../src/henrik/errors');
const { storedMatch, historyEntry } = require('./fixtures');

const NOW = Date.parse('2026-10-06T15:00:00Z');
const config = { minUpstreamIntervalSeconds: 20, sessionResetHour: 6, matchHistorySize: 20 };
const request = { region: 'eu', platform: 'pc', name: 'Joueur', tag: 'EUW', sinceMs: Date.parse('2026-10-06T10:00:00Z') };

function fakeClient(routes) {
    const calls = [];
    return {
        calls,
        get: async (path, query) => {
            calls.push({ path, query });
            const route = Object.keys(routes).find((prefix) => path.startsWith(prefix));
            const handler = routes[route];
            if (typeof handler === 'function') return handler();
            return handler;
        }
    };
}

const historyBody = {
    body: {
        data: {
            account: { name: 'Joueur', tag: 'EUW', puuid: 'p1' },
            history: [
                historyEntry({ date: '2026-10-06T12:00:00Z', tier: 19, rr: 67, lastChange: 18 }),
                historyEntry({ date: '2026-10-06T11:00:00Z', lastChange: -16 })
            ]
        }
    },
    cacheTtlSeconds: 280
};

const matchesBody = {
    body: {
        data: [
            storedMatch({ startedAt: '2026-10-06T12:00:00Z', team: 'Blue', red: 5, blue: 13, map: 'Pearl' }),
            storedMatch({ startedAt: '2026-10-06T11:00:00Z', team: 'Blue', red: 13, blue: 11 })
        ]
    },
    cacheTtlSeconds: 0
};

test('assemble rang, RR de session et bilan pour un overlay compétitif', async () => {
    const client = fakeClient({ '/valorant/v2/mmr-history': historyBody, '/valorant/v1/stored-matches': matchesBody });
    const service = createStatsService({ client, cache: createCache({ now: () => NOW }), config, now: () => NOW });

    const stats = await service.getStats(request);

    assert.deepEqual(stats.rank, {
        tierId: 19, name: 'Diamant 2', rr: 67, lastChange: 18,
        iconUrl: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/19/largeicon.png'
    });
    assert.equal(stats.session.wins, 1);
    assert.equal(stats.session.losses, 1);
    assert.equal(stats.session.rrDelta, 2);
    assert.equal(stats.session.latestMap, 'Pearl');
    assert.equal(stats.player.level, 150);
    assert.equal(stats.stale, false);
    assert.equal(client.calls[0].path, '/valorant/v2/mmr-history/eu/pc/Joueur/EUW');
    assert.deepEqual(client.calls[1].query, { mode: 'competitive', size: 20 });
});

test('respecte le TTL du cache HenrikDev : pas de nouvel appel MMR avant expiration', async () => {
    let time = NOW;
    const client = fakeClient({ '/valorant/v2/mmr-history': historyBody, '/valorant/v1/stored-matches': matchesBody });
    const service = createStatsService({ client, cache: createCache({ now: () => time }), config, now: () => time });

    await service.getStats(request);
    time += 20_000;
    await service.getStats(request);

    const mmrCalls = client.calls.filter((call) => call.path.includes('mmr-history')).length;
    const matchCalls = client.calls.filter((call) => call.path.includes('stored-matches')).length;
    assert.equal(mmrCalls, 1, 'mmr-history reste en cache (TTL HenrikDev 280 s)');
    assert.equal(matchCalls, 2, 'stored-matches est rafraîchi toutes les 20 s');
});

test('joueur sans historique classé : Non classé et données d’entrée conservées', async () => {
    const client = fakeClient({
        '/valorant/v2/mmr-history': { body: { data: { history: [] } }, cacheTtlSeconds: 0 },
        '/valorant/v1/stored-matches': { body: { data: [] }, cacheTtlSeconds: 0 }
    });
    const service = createStatsService({ client, cache: createCache({ now: () => NOW }), config, now: () => NOW });

    const stats = await service.getStats(request);

    assert.equal(stats.rank.name, 'Non classé');
    assert.equal(stats.rank.lastChange, null);
    assert.deepEqual(stats.player, { name: 'Joueur', tag: 'EUW', level: null });
});

test('marque les données comme anciennes quand l’API échoue après un premier succès', async () => {
    let time = NOW;
    let failing = false;
    const client = fakeClient({
        '/valorant/v2/mmr-history': historyBody,
        '/valorant/v1/stored-matches': () => {
            if (failing) throw new HenrikApiError({ status: 429, message: 'quota', retryAfterSeconds: 5 });
            return matchesBody;
        }
    });
    const service = createStatsService({ client, cache: createCache({ now: () => time }), config, now: () => time });

    await service.getStats(request);
    failing = true;
    time += 21_000;
    const stats = await service.getStats(request);

    assert.equal(stats.stale, true);
    assert.equal(stats.session.wins, 1);
});

test('premier chargement : le MMR en échec n’empêche pas d’afficher le bilan', async () => {
    const client = fakeClient({
        '/valorant/v2/mmr-history': () => { throw new HenrikApiError({ status: 429, code: 'LOCAL_RESERVE', message: 'réserve' }); },
        '/valorant/v1/stored-matches': matchesBody
    });
    const service = createStatsService({ client, cache: createCache({ now: () => NOW }), config, now: () => NOW });

    const stats = await service.getStats(request);

    assert.equal(stats.rank.name, 'Rang indisponible');
    assert.equal(stats.rank.lastChange, null);
    assert.equal(stats.session.wins, 1);
    assert.equal(stats.session.rrDelta, null);
    assert.equal(stats.stale, true);
});

test('premier chargement : l’historique de parties en échec n’empêche pas d’afficher le rang', async () => {
    const client = fakeClient({
        '/valorant/v2/mmr-history': historyBody,
        '/valorant/v1/stored-matches': () => { throw new HenrikApiError({ status: 503, message: 'down' }); }
    });
    const service = createStatsService({ client, cache: createCache({ now: () => NOW }), config, now: () => NOW });

    const stats = await service.getStats(request);

    assert.equal(stats.rank.name, 'Diamant 2');
    assert.equal(stats.session.games, 0);
    assert.equal(stats.player.name, 'Joueur');
    assert.equal(stats.stale, true);
});

test('échoue seulement quand aucune ressource n’est disponible', async () => {
    const client = fakeClient({
        '/valorant/v2/mmr-history': () => { throw new HenrikApiError({ status: 404, code: 22, message: 'a' }); },
        '/valorant/v1/stored-matches': () => { throw new HenrikApiError({ status: 404, code: 22, message: 'b' }); }
    });
    const service = createStatsService({ client, cache: createCache(), config });
    await assert.rejects(service.getStats(request), (error) => error.code === 22);
});

test('playerKey ignore la casse', () => {
    assert.equal(playerKey({ region: 'eu', name: 'JoUeur', tag: 'EuW' }), 'eu:joueur#euw');
});
