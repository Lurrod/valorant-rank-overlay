const test = require('node:test');
const assert = require('node:assert/strict');
const { getSessionStart, matchOutcome, summarizeMatches, summarizeRankHistory } = require('../src/stats/session');
const { storedMatch, historyEntry } = require('./fixtures');

test('getSessionStart utilise « since » quand il est valide', () => {
    const start = getSessionStart({ sinceMs: 1000, now: 5000 });
    assert.equal(start.getTime(), 1000);
});

test('getSessionStart ignore un « since » dans le futur', () => {
    const now = new Date(2026, 9, 6, 14, 0).getTime();
    const start = getSessionStart({ sinceMs: now + 1000, now, resetHour: 6 });
    assert.equal(start.getTime(), new Date(2026, 9, 6, 6, 0).getTime());
});

test('getSessionStart revient à la veille avant l’heure de réinitialisation', () => {
    const now = new Date(2026, 9, 6, 2, 30).getTime();
    const start = getSessionStart({ now, resetHour: 6 });
    assert.equal(start.getTime(), new Date(2026, 9, 5, 6, 0).getTime());
});

test('matchOutcome distingue victoire, défaite et nul', () => {
    assert.equal(matchOutcome(storedMatch({ startedAt: 'x', team: 'Blue', red: 7, blue: 13 })), 'win');
    assert.equal(matchOutcome(storedMatch({ startedAt: 'x', team: 'Red', red: 7, blue: 13 })), 'loss');
    assert.equal(matchOutcome(storedMatch({ startedAt: 'x', team: 'red', red: 12, blue: 12 })), 'draw');
    assert.equal(matchOutcome({ stats: { team: 'Blue' }, teams: {} }), null);
    assert.equal(matchOutcome(null), null);
});

test('summarizeMatches ne compte que les parties de la session', () => {
    const sessionStart = new Date('2026-10-06T10:00:00Z');
    const matches = [
        storedMatch({ startedAt: '2026-10-06T09:00:00Z', team: 'Blue', red: 13, blue: 2, map: 'Bind' }),
        storedMatch({ startedAt: '2026-10-06T12:00:00Z', team: 'Blue', red: 7, blue: 13, map: 'Lotus', agent: 'Sova', kills: 10, deaths: 5, assists: 2 }),
        storedMatch({ startedAt: '2026-10-06T11:00:00Z', team: 'Red', red: 9, blue: 13, kills: 15, deaths: 15, assists: 3 }),
        storedMatch({ startedAt: '2026-10-06T10:30:00Z', team: 'Red', red: 12, blue: 12, kills: 1, deaths: 1, assists: 1 })
    ];

    const summary = summarizeMatches(matches, sessionStart);

    assert.deepEqual(
        { wins: summary.wins, losses: summary.losses, draws: summary.draws, games: summary.games, winrate: summary.winrate },
        { wins: 1, losses: 1, draws: 1, games: 3, winrate: 33 }
    );
    assert.deepEqual([summary.kills, summary.deaths, summary.assists], [26, 21, 6]);
    assert.equal(summary.latestMap, 'Lotus');
    assert.equal(summary.latestAgent, 'Sova');
    assert.equal(summary.level, 150);
    assert.deepEqual(summary.player, { name: 'Joueur', tag: 'EUW' });
});

test('summarizeMatches gère une liste vide ou absente', () => {
    const summary = summarizeMatches(undefined, new Date());
    assert.equal(summary.games, 0);
    assert.equal(summary.winrate, null);
    assert.equal(summary.latestMap, null);
    assert.equal(summary.level, null);
    assert.equal(summary.player, null);
});

test('summarizeMatches garde le niveau même sans partie dans la session', () => {
    const summary = summarizeMatches([storedMatch({ startedAt: '2020-01-01T00:00:00Z', level: 321 })], new Date('2026-01-01'));
    assert.equal(summary.games, 0);
    assert.equal(summary.level, 321);
    assert.equal(summary.latestMap, null);
});

test('summarizeRankHistory donne le rang actuel et le bilan RR de la session', () => {
    const sessionStart = new Date('2026-10-06T10:00:00Z');
    const history = [
        historyEntry({ date: '2026-10-06T12:00:00Z', tier: 19, rr: 12, lastChange: 21 }),
        historyEntry({ date: '2026-10-06T11:00:00Z', lastChange: -15 }),
        historyEntry({ date: '2026-10-05T11:00:00Z', lastChange: 30 })
    ];

    const summary = summarizeRankHistory(history, sessionStart);

    assert.deepEqual(summary.current, { tierId: 19, rr: 12, lastChange: 21 });
    assert.equal(summary.rrDelta, 6);
});

test('summarizeRankHistory sans historique', () => {
    const summary = summarizeRankHistory([], new Date());
    assert.equal(summary.current, null);
    assert.equal(summary.rrDelta, null);
    assert.equal(summarizeRankHistory(undefined, new Date()).current, null);
});

test('summarizeRankHistory tolère des champs manquants', () => {
    const summary = summarizeRankHistory([{ date: 'invalide' }], new Date());
    assert.deepEqual(summary.current, { tierId: 0, rr: 0, lastChange: null });
    assert.equal(summary.rrDelta, null);
});
