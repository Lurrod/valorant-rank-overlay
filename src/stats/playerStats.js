// Assemble les statistiques affichées par les overlays en économisant le quota HenrikDev :
// - mmr-history v2  : rang, RR, variation (HenrikDev le met en cache ~5 min, on respecte ce délai)
// - stored-matches  : V/D/N, K/D/A, carte, agent, niveau (1 appel léger, parties classées uniquement)

const { rankName, rankIconUrl } = require('./ranks');
const { getSessionStart, summarizeMatches, summarizeRankHistory } = require('./session');

const MATCH_MODE = 'competitive';

const UNAVAILABLE_RANK = Object.freeze({ tierId: 0, name: 'Rang indisponible', rr: 0, lastChange: null, iconUrl: rankIconUrl(0) });

function playerKey({ region, name, tag }) {
    return `${region}:${name.toLowerCase()}#${tag.toLowerCase()}`;
}

function createStatsService({ client, cache, config, now = Date.now }) {
    const minIntervalMs = config.minUpstreamIntervalSeconds * 1000;
    const enc = encodeURIComponent;

    function ttlFrom(cacheTtlSeconds) {
        // Inutile de redemander avant l'expiration du cache HenrikDev : la réponse serait identique.
        return Math.max(minIntervalMs, (cacheTtlSeconds + 1) * 1000);
    }

    function fetchRankHistory(player) {
        const path = `/valorant/v2/mmr-history/${player.region}/${player.platform}/${enc(player.name)}/${enc(player.tag)}`;
        return cache.get(`mmr-history:${player.platform}:${playerKey(player)}`, async () => {
            const { body, cacheTtlSeconds } = await client.get(path);
            return { value: body?.data ?? null, ttlMs: ttlFrom(cacheTtlSeconds) };
        });
    }

    function fetchMatches(player) {
        const path = `/valorant/v1/stored-matches/${player.region}/${enc(player.name)}/${enc(player.tag)}`;
        return cache.get(`stored-matches:${playerKey(player)}`, async () => {
            const { body, cacheTtlSeconds } = await client.get(path, { mode: MATCH_MODE, size: config.matchHistorySize });
            return { value: body?.data ?? [], ttlMs: ttlFrom(cacheTtlSeconds) };
        });
    }

    function buildRank(rankSummary) {
        const tierId = rankSummary.current?.tierId ?? 0;
        return {
            tierId,
            name: rankName(tierId),
            rr: rankSummary.current?.rr ?? 0,
            lastChange: rankSummary.current?.lastChange ?? null,
            iconUrl: rankIconUrl(tierId)
        };
    }

    // Une ressource en échec ne doit pas masquer l'autre : on affiche ce qui est disponible
    // (marqué « stale ») et on n'échoue que si rien n'a pu être obtenu.
    async function fetchAll(player) {
        const settled = await Promise.allSettled([fetchRankHistory(player), fetchMatches(player)]);
        if (settled.every((outcome) => outcome.status === 'rejected')) throw settled[0].reason;

        const [history, matches] = settled.map((outcome) => (outcome.status === 'fulfilled' ? outcome.value : undefined));
        return { history, matches, partial: settled.some((outcome) => outcome.status === 'rejected') };
    }

    async function getStats({ region, platform = 'pc', name, tag, sinceMs = null }) {
        const player = { region, platform, name, tag };
        const sessionStart = getSessionStart({ sinceMs, now: now(), resetHour: config.sessionResetHour });

        const { history: historyResult, matches: matchesResult, partial } = await fetchAll(player);

        const session = summarizeMatches(matchesResult?.value, sessionStart);
        const rankSummary = summarizeRankHistory(historyResult?.value?.history, sessionStart);
        const rank = historyResult ? buildRank(rankSummary) : UNAVAILABLE_RANK;
        const account = historyResult?.value?.account || session.player || { name, tag };
        const results = [historyResult, matchesResult].filter(Boolean);

        return {
            player: { name: account.name || name, tag: account.tag || tag, level: session.level },
            rank,
            session: {
                start: sessionStart.toISOString(),
                wins: session.wins,
                losses: session.losses,
                draws: session.draws,
                games: session.games,
                winrate: session.winrate,
                kills: session.kills,
                deaths: session.deaths,
                assists: session.assists,
                latestMap: session.latestMap,
                latestAgent: session.latestAgent,
                rrDelta: rankSummary.rrDelta
            },
            stale: partial || results.some((result) => result.stale),
            updatedAt: new Date(Math.min(...results.map((result) => result.fetchedAt))).toISOString()
        };
    }

    return { getStats };
}

module.exports = { createStatsService, playerKey };
