// Validation des paramètres d'URL des overlays (frontière du système : on ne fait confiance à rien).

const { REGIONS, PLATFORMS, OVERLAY_STYLES } = require('./config');

const NAME_MAX_LENGTH = 16;
const TAG_MAX_LENGTH = 5;
const FORBIDDEN_CHARACTERS = /[\u0000-\u001f/\\?#<>]/;

function invalid(message, details) {
    return { ok: false, error: { message, details } };
}

function parseSince(raw, now) {
    if (raw === undefined || raw === '') return { ok: true, value: null };
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0 || value > now) {
        return invalid('Paramètre « since » invalide.', 'Attendu : un horodatage en millisecondes dans le passé.');
    }
    return { ok: true, value };
}

function parseOverlayRequest(params, query = {}, now = Date.now()) {
    const style = String(params.style || '').toLowerCase();
    const region = String(params.region || '').toLowerCase();
    const platform = String(query.platform || 'pc').toLowerCase();
    const name = String(params.name || '').trim();
    const tag = String(params.tag || '').trim().replace(/^#/, '');

    if (!Object.hasOwn(OVERLAY_STYLES, style)) {
        return invalid(`Style « ${params.style} » inconnu.`, `Styles disponibles : ${Object.keys(OVERLAY_STYLES).join(', ')}.`);
    }
    if (!Object.hasOwn(REGIONS, region)) {
        return invalid(`Région « ${params.region} » inconnue.`, `Régions disponibles : ${Object.keys(REGIONS).join(', ')}.`);
    }
    if (!Object.hasOwn(PLATFORMS, platform)) {
        return invalid(`Plateforme « ${query.platform} » inconnue.`, 'Plateformes disponibles : pc, console.');
    }
    if (!name || name.length > NAME_MAX_LENGTH || FORBIDDEN_CHARACTERS.test(name)) {
        return invalid('Pseudo Riot invalide.', `Entre 1 et ${NAME_MAX_LENGTH} caractères.`);
    }
    if (!tag || tag.length > TAG_MAX_LENGTH || FORBIDDEN_CHARACTERS.test(tag)) {
        return invalid('Tag Riot invalide.', `Entre 1 et ${TAG_MAX_LENGTH} caractères, sans « # ».`);
    }

    const since = parseSince(query.since, now);
    if (!since.ok) return since;

    return {
        ok: true,
        value: { style, region, platform, name, tag, sinceMs: since.value }
    };
}

module.exports = { parseOverlayRequest, NAME_MAX_LENGTH, TAG_MAX_LENGTH };
