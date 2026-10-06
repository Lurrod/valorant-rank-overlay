const test = require('node:test');
const assert = require('node:assert/strict');
const { parseOverlayRequest } = require('../src/validation');

const NOW = 1_800_000_000_000;
const base = { style: 'Aura', name: ' Joueur ', tag: '#EUW', region: 'EU' };

test('parseOverlayRequest normalise une requête valide', () => {
    const result = parseOverlayRequest(base, { since: '1700000000000', platform: 'Console' }, NOW);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {
        style: 'aura', region: 'eu', platform: 'console',
        name: 'Joueur', tag: 'EUW', sinceMs: 1700000000000
    });
});

test('parseOverlayRequest : PC par défaut, sans « since », et Swiftplay n’existe plus', () => {
    const result = parseOverlayRequest({ ...base, style: 'compact' }, {}, NOW);
    assert.equal(result.value.platform, 'pc');
    assert.equal(result.value.sinceMs, null);
    assert.equal(parseOverlayRequest({ ...base, style: 'swiftplay' }, {}, NOW).ok, false);
});

test('parseOverlayRequest rejette les entrées invalides avec un message en français', () => {
    const cases = [
        [{ ...base, style: 'inconnu' }, {}, /Style/],
        [{ ...base, region: 'mars' }, {}, /Région/],
        [base, { platform: 'switch' }, /Plateforme/],
        [{ ...base, name: '' }, {}, /Pseudo/],
        [{ ...base, name: 'x'.repeat(17) }, {}, /Pseudo/],
        [{ ...base, name: 'a<b' }, {}, /Pseudo/],
        [{ ...base, tag: '#' }, {}, /Tag/],
        [{ ...base, tag: 'TROPLONG' }, {}, /Tag/],
        [base, { since: 'abc' }, /since/],
        [base, { since: String(NOW + 1) }, /since/],
        [base, { since: '-5' }, /since/]
    ];
    for (const [params, query, pattern] of cases) {
        const result = parseOverlayRequest(params, query, NOW);
        assert.equal(result.ok, false, JSON.stringify({ params, query }));
        assert.match(result.error.message, pattern);
        assert.ok(result.error.details);
    }
});
