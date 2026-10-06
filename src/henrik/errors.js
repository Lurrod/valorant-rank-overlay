// Erreurs de l'API HenrikDev et leur traduction en messages lisibles pour le stream.

class HenrikApiError extends Error {
    constructor({ status, code = null, message, retryAfterSeconds = null }) {
        super(message);
        this.name = 'HenrikApiError';
        this.status = status;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

// Codes documentés sur https://docs.henrikdev.xyz/valorant/error-codes
const MESSAGES_BY_CODE = Object.freeze({
    6: 'Région invalide.',
    22: 'Compte introuvable. Vérifie le pseudo, le tag et la région.',
    23: 'Région du joueur inconnue : lance une partie puis réessaie.',
    24: 'Compte introuvable. Vérifie le pseudo, le tag et la région.',
    25: 'Aucune donnée de classé pour ce joueur.',
    42: 'Plateforme invalide (pc ou console).'
});

function toUserMessage(error) {
    if (!(error instanceof HenrikApiError)) return 'Erreur inattendue du serveur.';
    if (MESSAGES_BY_CODE[error.code]) return MESSAGES_BY_CODE[error.code];

    switch (error.status) {
        case 401:
        case 403:
            return 'Clé API HenrikDev manquante ou invalide (fichier .env).';
        case 404:
            return 'Joueur introuvable. Vérifie le pseudo, le tag et la région.';
        case 429:
            return error.retryAfterSeconds
                ? `Quota de l'API atteint, nouvel essai dans ${error.retryAfterSeconds} s.`
                : "Quota de l'API atteint, nouvel essai sous peu.";
        case 0:
            return 'API HenrikDev injoignable. Vérifie la connexion.';
        default:
            return error.status >= 500
                ? "L'API HenrikDev rencontre un problème, nouvel essai sous peu."
                : 'Requête refusée par l’API HenrikDev.';
    }
}

// Statut HTTP renvoyé par NOTRE API pour une erreur amont.
function toHttpStatus(error) {
    if (!(error instanceof HenrikApiError)) return 500;
    if (error.status === 404 || error.status === 429) return error.status;
    if (error.status === 400) return 400;
    return 502;
}

module.exports = { HenrikApiError, toUserMessage, toHttpStatus };
