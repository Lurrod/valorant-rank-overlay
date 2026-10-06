const test = require('node:test');
const assert = require('node:assert/strict');
const { rankName, rankIconUrl, UNRANKED_LABEL } = require('../src/stats/ranks');

test('rankName traduit les paliers en français', () => {
    assert.equal(rankName(3), 'Fer 1');
    assert.equal(rankName(11), 'Argent 3');
    assert.equal(rankName(12), 'Or 1');
    assert.equal(rankName(20), 'Diamant 3');
    assert.equal(rankName(24), 'Immortel 1');
    assert.equal(rankName(27), 'Radiant');
});

test('rankName renvoie « Non classé » pour les paliers inconnus', () => {
    assert.equal(rankName(0), UNRANKED_LABEL);
    assert.equal(rankName(1), UNRANKED_LABEL);
    assert.equal(rankName(99), UNRANKED_LABEL);
    assert.equal(rankName(undefined), UNRANKED_LABEL);
});

test('rankIconUrl construit l’URL valorant-api et borne le palier', () => {
    assert.match(rankIconUrl(18), /\/competitivetiers\/[0-9a-f-]+\/18\/largeicon\.png$/);
    assert.match(rankIconUrl(-4), /\/0\/largeicon\.png$/);
    assert.match(rankIconUrl('27'), /\/0\/largeicon\.png$/);
});
