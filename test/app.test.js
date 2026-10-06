const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { buildApiPath } = require('../src/routes/overlays');
const { createRateLimiter } = require('../src/henrik/rateLimiter');
const { HenrikApiError } = require('../src/henrik/errors');

const silent = { error: () => {} };
const config = { clientRefreshSeconds: 20, sessionResetHour: 6, isDevelopment: false };

const sampleStats = {
    player: { name: 'Joueur', tag: 'EUW', level: 212 },
    rank: { tierId: 19, name: 'Diamant 2', rr: 67, lastChange: 18, iconUrl: 'https://media.valorant-api.com/x.png' },
    session: { start: '2026-10-06T04:00:00.000Z', wins: 4, losses: 2, draws: 1, games: 7, winrate: 57, kills: 1, deaths: 2, assists: 3, latestMap: 'Bind', latestAgent: 'Jett', rrDelta: 34 },
    stale: false,
    updatedAt: '2026-10-06T12:00:00.000Z'
};

async function withServer(statsService, run, extraConfig = {}) {
    const app = createApp({ statsService, rateLimiter: createRateLimiter(), config: { ...config, ...extraConfig }, logger: silent });
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        await run(base);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

const okService = { getStats: async () => sampleStats };

test('la page d’accueil est en français et liste styles, régions et plateformes', async () => {
    await withServer(okService, async (base) => {
        const response = await fetch(`${base}/`);
        const html = await response.text();
        assert.equal(response.status, 200);
        assert.match(html, /<html lang="fr">/);
        for (const label of ['Aura', 'Classique', 'Compact', 'Europe', 'Console', '20 s', 'select-chevron']) {
            assert.ok(html.includes(label), label);
        }
        assert.ok(!html.includes('Swiftplay'), 'Swiftplay a été retiré');
        assert.match(html, /href="\/css\/home\.css\?v=[0-9a-z]+"/, 'CSS versionné pour contourner le cache');
        assert.match(html, /class="select-chevron" width="18" height="18"/, 'chevron dimensionné même sans CSS');

        const css = await fetch(`${base}/css/home.css`);
        assert.equal(css.headers.get('cache-control'), 'no-cache');
    });
});

test('chaque style d’overlay se rend avec les données et l’URL de mise à jour', async () => {
    await withServer(okService, async (base) => {
        for (const style of ['aura', 'clean', 'compact']) {
            const response = await fetch(`${base}/overlay/${style}/Joueur/EUW/eu?since=1700000000000`);
            const html = await response.text();
            assert.equal(response.status, 200, style);
            assert.ok(html.includes('data-api="/api/stats/' + style + '/Joueur/EUW/eu?since=1700000000000"'), style);
            assert.ok(html.includes('data-refresh="20"'), style);
            assert.match(html, /data-field="wins">4</, style);
            assert.doesNotMatch(html, /via\.placeholder\.com/, style);
            assert.ok(html.includes(`/css/${style}.css?v=`), `${style} : feuille de style versionnée`);
        }
    });
});

test('un style inconnu ou une région invalide renvoie 400 avec un message en français', async () => {
    await withServer(okService, async (base) => {
        const unknown = await fetch(`${base}/overlay/neon/Joueur/EUW/eu`);
        assert.equal(unknown.status, 400);
        assert.match(await unknown.text(), /Style « neon » inconnu/);

        const region = await fetch(`${base}/overlay/aura/Joueur/EUW/mars`);
        assert.equal(region.status, 400);
        assert.match(await region.text(), /Région « mars » inconnue/);
    });
});

test('une erreur amont affiche un message lisible et garde le rafraîchissement actif', async () => {
    const failing = { getStats: async () => { throw new HenrikApiError({ status: 404, code: 22, message: 'Account not found' }); } };
    await withServer(failing, async (base) => {
        const response = await fetch(`${base}/overlay/aura/Inconnu/0000/eu`);
        const html = await response.text();
        assert.equal(response.status, 404);
        assert.match(html, /Compte introuvable/);
        assert.match(html, /data-state="error"/);
        assert.match(html, /data-refresh="20"/);
        assert.doesNotMatch(html, /Account not found/, 'pas de détail technique hors mode développement');
    });
});

test('en mode développement, le détail technique est affiché', async () => {
    const failing = { getStats: async () => { throw new HenrikApiError({ status: 500, message: 'Upstream exploded' }); } };
    await withServer(failing, async (base) => {
        const html = await (await fetch(`${base}/overlay/clean/Joueur/EUW/eu`)).text();
        assert.match(html, /Upstream exploded/);
    }, { isDevelopment: true });
});

test('l’API JSON renvoie l’enveloppe success/data/error', async () => {
    await withServer(okService, async (base) => {
        const response = await fetch(`${base}/api/stats/compact/Joueur/EUW/eu`);
        const payload = await response.json();
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(payload.success, true);
        assert.equal(payload.data.rank.name, 'Diamant 2');

        const removed = await fetch(`${base}/api/stats/swiftplay/Joueur/EUW/eu`);
        assert.equal(removed.status, 400);
        assert.equal(payload.error, null);

        const invalid = await fetch(`${base}/api/stats/aura/Joueur/EUW/mars`);
        assert.equal(invalid.status, 400);
        assert.match((await invalid.json()).error, /Région/);
    });
});

test('l’API JSON transmet le délai de nouvel essai en cas de quota atteint', async () => {
    const limited = { getStats: async () => { throw new HenrikApiError({ status: 429, message: 'quota', retryAfterSeconds: 12 }); } };
    await withServer(limited, async (base) => {
        const response = await fetch(`${base}/api/stats/aura/Joueur/EUW/eu`);
        const payload = await response.json();
        assert.equal(response.status, 429);
        assert.equal(payload.retryAfterSeconds, 12);
        assert.match(payload.error, /12 s/);
    });
});

test('/api/quota expose l’état du quota et les routes inconnues répondent 404', async () => {
    await withServer(okService, async (base) => {
        const quota = await (await fetch(`${base}/api/quota`)).json();
        assert.equal(quota.success, true);
        assert.equal(quota.data.blocked, false);

        const missing = await fetch(`${base}/nimporte-quoi`);
        assert.equal(missing.status, 404);
        assert.match((await missing.json()).error, /introuvable/);
    });
});

test('buildApiPath encode le pseudo et n’ajoute la plateforme que hors PC', () => {
    const request = { style: 'aura', name: 'Joueur Pro', tag: 'É1', region: 'eu', platform: 'console', sinceMs: null };
    assert.equal(buildApiPath(request), '/api/stats/aura/Joueur%20Pro/%C3%891/eu?platform=console');
    assert.equal(buildApiPath({ ...request, platform: 'pc' }), '/api/stats/aura/Joueur%20Pro/%C3%891/eu');
});
