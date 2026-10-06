// Rangs Valorant : identifiant de palier (API) -> nom français + icône.

// Jeu d'icônes des paliers actuels (Épisode 5+), servi par valorant-api.com (aucun quota).
const COMPETITIVE_TIERS_UUID = '03621f52-342b-cf4e-4f86-9350a49c6d04';

const DIVISIONS = Object.freeze([
    { firstTier: 3, name: 'Fer' },
    { firstTier: 6, name: 'Bronze' },
    { firstTier: 9, name: 'Argent' },
    { firstTier: 12, name: 'Or' },
    { firstTier: 15, name: 'Platine' },
    { firstTier: 18, name: 'Diamant' },
    { firstTier: 21, name: 'Ascendant' },
    { firstTier: 24, name: 'Immortel' }
]);

const RADIANT_TIER = 27;
const UNRANKED_LABEL = 'Non classé';

function rankName(tierId) {
    if (tierId === RADIANT_TIER) return 'Radiant';
    const division = DIVISIONS.find(({ firstTier }) => tierId >= firstTier && tierId < firstTier + 3);
    return division ? `${division.name} ${tierId - division.firstTier + 1}` : UNRANKED_LABEL;
}

function rankIconUrl(tierId) {
    const safeTier = Number.isInteger(tierId) && tierId >= 0 && tierId <= RADIANT_TIER ? tierId : 0;
    return `https://media.valorant-api.com/competitivetiers/${COMPETITIVE_TIERS_UUID}/${safeTier}/largeicon.png`;
}

module.exports = { rankName, rankIconUrl, UNRANKED_LABEL, RADIANT_TIER };
