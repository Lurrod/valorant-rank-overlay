// Calculs de session (fonctions pures) à partir des réponses HenrikDev.

const HOUR_MS = 60 * 60 * 1000;

// Début de session : `since` explicite, sinon la dernière occurrence de `resetHour` (heure locale).
function getSessionStart({ sinceMs = null, now = Date.now(), resetHour = 6 } = {}) {
    if (Number.isFinite(sinceMs) && sinceMs > 0 && sinceMs <= now) return new Date(sinceMs);
    const start = new Date(now);
    start.setHours(resetHour, 0, 0, 0);
    if (start.getTime() > now) return new Date(start.getTime() - 24 * HOUR_MS);
    return start;
}

function matchOutcome(match) {
    const team = String(match?.stats?.team || '').toLowerCase();
    const own = match?.teams?.[team];
    const opponent = match?.teams?.[team === 'red' ? 'blue' : 'red'];
    if (!Number.isFinite(own) || !Number.isFinite(opponent)) return null;
    if (own > opponent) return 'win';
    if (own < opponent) return 'loss';
    return 'draw';
}

function isInSession(dateString, sessionStart) {
    const time = Date.parse(dateString);
    return Number.isFinite(time) && time >= sessionStart.getTime();
}

// stored-matches v1 -> bilan V/D/N, K/D/A et dernière partie.
function summarizeMatches(matches, sessionStart) {
    const sorted = [...(Array.isArray(matches) ? matches : [])]
        .sort((a, b) => Date.parse(b?.meta?.started_at) - Date.parse(a?.meta?.started_at));
    const sessionMatches = sorted.filter((match) => isInSession(match?.meta?.started_at, sessionStart));

    const totals = sessionMatches.reduce((acc, match) => {
        const outcome = matchOutcome(match);
        return {
            wins: acc.wins + (outcome === 'win' ? 1 : 0),
            losses: acc.losses + (outcome === 'loss' ? 1 : 0),
            draws: acc.draws + (outcome === 'draw' ? 1 : 0),
            kills: acc.kills + (match.stats?.kills || 0),
            deaths: acc.deaths + (match.stats?.deaths || 0),
            assists: acc.assists + (match.stats?.assists || 0)
        };
    }, { wins: 0, losses: 0, draws: 0, kills: 0, deaths: 0, assists: 0 });

    const games = totals.wins + totals.losses + totals.draws;
    const latest = sorted[0] || null;
    const latestInSession = sessionMatches[0] || null;

    return {
        ...totals,
        games,
        winrate: games > 0 ? Math.round((totals.wins / games) * 100) : null,
        latestMap: latestInSession?.meta?.map?.name || null,
        latestAgent: latestInSession?.stats?.character?.name || null,
        level: latest?.stats?.level || null,
        player: latest?.stats?.name ? { name: latest.stats.name, tag: latest.stats.tag } : null
    };
}

// mmr-history v2 -> rang actuel et RR gagnés/perdus pendant la session.
function summarizeRankHistory(history, sessionStart) {
    const entries = Array.isArray(history) ? history : [];
    const latest = entries[0] || null;
    const sessionEntries = entries.filter((entry) => isInSession(entry?.date, sessionStart));

    return {
        current: latest
            ? { tierId: latest.tier?.id ?? 0, rr: latest.rr ?? 0, lastChange: Number.isFinite(latest.last_change) ? latest.last_change : null }
            : null,
        rrDelta: sessionEntries.length > 0
            ? sessionEntries.reduce((sum, entry) => sum + (entry.last_change || 0), 0)
            : null
    };
}

module.exports = { getSessionStart, matchOutcome, summarizeMatches, summarizeRankHistory };
