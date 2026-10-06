// Formatage des statistiques en champs d'affichage. Partagé entre le rendu serveur (EJS)
// et la mise à jour en direct dans le navigateur, pour garantir un affichage identique.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.OverlayFields = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var MINUS = '\u2212';
    var NBSP = '\u00a0';

    function signed(value) {
        if (typeof value !== 'number') return '';
        return (value >= 0 ? '+' : MINUS) + Math.abs(value);
    }

    function sign(value) {
        if (typeof value !== 'number') return '';
        return value >= 0 ? 'up' : 'down';
    }

    function computeFields(stats) {
        var rank = stats.rank;
        var session = stats.session;
        var player = stats.player;
        var lastChange = rank ? rank.lastChange : null;
        var hasGames = session.games > 0;

        return {
            text: {
                player: player.name,
                tag: '#' + player.tag,
                level: player.level ? String(player.level) : '',
                rank: rank ? rank.name : 'Non classé',
                rr: rank ? String(rank.rr) : '',
                delta: signed(lastChange),
                'session-rr': signed(session.rrDelta) || '—',
                wins: String(session.wins),
                losses: String(session.losses),
                draws: String(session.draws),
                winrate: session.winrate === null ? '—' : session.winrate + NBSP + '%',
                kda: session.kills + ' / ' + session.deaths + ' / ' + session.assists,
                map: session.latestMap || '',
                agent: session.latestAgent || ''
            },
            visible: {
                level: Boolean(player.level),
                delta: typeof lastChange === 'number',
                'session-rr': typeof session.rrDelta === 'number',
                draws: session.draws > 0,
                kda: hasGames,
                map: Boolean(session.latestMap),
                agent: Boolean(session.latestAgent),
                stale: Boolean(stats.stale)
            },
            sign: {
                delta: sign(lastChange),
                'session-rr': sign(session.rrDelta)
            },
            rankIcon: rank ? rank.iconUrl : null,
            rankName: rank ? rank.name : ''
        };
    }

    return { computeFields: computeFields };
});
