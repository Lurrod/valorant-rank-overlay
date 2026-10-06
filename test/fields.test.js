const test = require('node:test');
const assert = require('node:assert/strict');
const { computeFields } = require('../public/js/fields');

function stats(overrides = {}) {
    return {
        player: { name: 'Joueur', tag: 'EUW', level: 212 },
        rank: { tierId: 19, name: 'Diamant 2', rr: 67, lastChange: 18, iconUrl: 'icon.png' },
        session: { wins: 4, losses: 2, draws: 1, games: 7, winrate: 57, kills: 80, deaths: 60, assists: 20, latestMap: 'Bind', latestAgent: 'Jett', rrDelta: -12 },
        stale: false,
        ...overrides
    };
}

test('computeFields formate un joueur classé', () => {
    const fields = computeFields(stats());

    assert.equal(fields.text.rank, 'Diamant 2');
    assert.equal(fields.text.tag, '#EUW');
    assert.equal(fields.text.delta, '+18');
    assert.equal(fields.text['session-rr'], '−12');
    assert.equal(fields.text.winrate, '57 %');
    assert.equal(fields.text.kda, '80 / 60 / 20');
    assert.equal(fields.sign.delta, 'up');
    assert.equal(fields.sign['session-rr'], 'down');
    assert.equal(fields.visible.draws, true);
    assert.equal(fields.rankIcon, 'icon.png');
});

test('computeFields sans rang ni partie dans la session', () => {
    const fields = computeFields(stats({
        player: { name: 'Joueur', tag: 'EUW', level: null },
        rank: null,
        session: { wins: 0, losses: 0, draws: 0, games: 0, winrate: null, kills: 0, deaths: 0, assists: 0, latestMap: null, latestAgent: null, rrDelta: null },
        stale: true
    }));

    assert.equal(fields.text.rank, 'Non classé');
    assert.equal(fields.text.winrate, '—');
    assert.equal(fields.text.delta, '');
    assert.equal(fields.text['session-rr'], '—');
    assert.equal(fields.visible['session-rr'], false);
    assert.equal(fields.visible.level, false);
    assert.equal(fields.visible.delta, false);
    assert.equal(fields.visible.kda, false);
    assert.equal(fields.visible.stale, true);
    assert.equal(fields.rankIcon, null);
});

test('computeFields affiche les RR au-delà de 100 sans les plafonner (Immortel 3, Radiant)', () => {
    const immortal = computeFields(stats({ rank: { tierId: 26, name: 'Immortel 3', rr: 245, lastChange: 21, iconUrl: 'i.png' } }));
    assert.equal(immortal.text.rr, '245');

    const radiant = computeFields(stats({ rank: { tierId: 27, name: 'Radiant', rr: 1090, lastChange: 0, iconUrl: 'r.png' } }));
    assert.equal(radiant.text.rr, '1090');
    assert.equal(radiant.text.delta, '+0');
});
