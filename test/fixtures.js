// Données de test calquées sur les réponses réelles de l'API HenrikDev (octobre 2026).

function storedMatch({ startedAt, team = 'Blue', red = 7, blue = 13, mode = 'Competitive', map = 'Ascent', agent = 'Jett', kills = 20, deaths = 10, assists = 5, level = 150 }) {
    return {
        meta: { id: `m-${startedAt}`, map: { id: 'map', name: map }, mode, started_at: startedAt, region: 'eu' },
        stats: { puuid: 'p1', name: 'Joueur', tag: 'EUW', team, level, character: { id: 'a', name: agent }, kills, deaths, assists },
        teams: { red, blue }
    };
}

function historyEntry({ date, tier = 18, rr = 50, lastChange = 18 }) {
    return {
        tier: { id: tier, name: 'Diamond 1' },
        match_id: `h-${date}`,
        map: { id: 'map', name: 'Ascent' },
        rr,
        last_change: lastChange,
        date
    };
}

function headers(values = {}) {
    const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
    return { get: (name) => (map.has(name.toLowerCase()) ? map.get(name.toLowerCase()) : null) };
}

function jsonResponse(body, { status = 200, headerValues = {} } = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: headers(headerValues),
        json: async () => body
    };
}

module.exports = { storedMatch, historyEntry, headers, jsonResponse };
