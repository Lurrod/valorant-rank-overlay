// Routes des overlays (pages OBS) et de l'API JSON qui les met à jour en direct.

const express = require('express');
const { computeFields } = require('../../public/js/fields');
const { parseOverlayRequest } = require('../validation');
const { toUserMessage, toHttpStatus } = require('../henrik/errors');

function buildApiPath(request) {
    const enc = encodeURIComponent;
    const query = new URLSearchParams();
    if (request.sinceMs) query.set('since', String(request.sinceMs));
    if (request.platform !== 'pc') query.set('platform', request.platform);
    const queryString = query.toString();
    return `/api/stats/${request.style}/${enc(request.name)}/${enc(request.tag)}/${request.region}${queryString ? `?${queryString}` : ''}`;
}

function templateFor(style) {
    return `overlays/${style}`;
}

function createOverlayRouter({ statsService, config, logger = console }) {
    const router = express.Router();

    function describeError(error) {
        return {
            message: toUserMessage(error),
            details: config.isDevelopment ? error.message : null
        };
    }

    router.get('/overlay/:style/:name/:tag/:region', async (req, res) => {
        const parsed = parseOverlayRequest(req.params, req.query);
        const fallbackPlayer = { name: req.params.name, tag: req.params.tag };

        if (!parsed.ok) {
            const requestedStyle = String(req.params.style).toLowerCase();
            const style = Object.hasOwn(config.styles, requestedStyle) ? requestedStyle : 'clean';
            return res.status(400).render(templateFor(style), {
                fields: null, player: fallbackPlayer, error: parsed.error, apiPath: '', refreshSeconds: 0
            });
        }

        const request = parsed.value;
        const view = { player: fallbackPlayer, apiPath: buildApiPath(request), refreshSeconds: config.clientRefreshSeconds };

        try {
            const stats = await statsService.getStats(request);
            res.render(templateFor(request.style), { ...view, player: stats.player, fields: computeFields(stats), error: null });
        } catch (error) {
            logger.error(`[overlay] ${request.style} ${request.name}#${request.tag} (${request.region}) :`, error.message);
            res.status(toHttpStatus(error)).render(templateFor(request.style), { ...view, fields: null, error: describeError(error) });
        }
    });

    router.get('/api/stats/:style/:name/:tag/:region', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const parsed = parseOverlayRequest(req.params, req.query);
        if (!parsed.ok) {
            return res.status(400).json({ success: false, data: null, error: parsed.error.message });
        }

        try {
            const stats = await statsService.getStats(parsed.value);
            res.json({ success: true, data: stats, error: null });
        } catch (error) {
            logger.error(`[api] ${parsed.value.name}#${parsed.value.tag} :`, error.message);
            res.status(toHttpStatus(error)).json({
                success: false,
                data: null,
                error: toUserMessage(error),
                retryAfterSeconds: error.retryAfterSeconds ?? null
            });
        }
    });

    return router;
}

module.exports = { createOverlayRouter, buildApiPath };
