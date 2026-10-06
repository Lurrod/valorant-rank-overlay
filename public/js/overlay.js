// Mise à jour en direct des overlays : interroge l'API locale et remplace les valeurs
// sur place (aucun rechargement, donc aucune image vide dans OBS).
(() => {
    const FADE_MS = 450;
    const { api, refresh, state } = document.body.dataset;
    const refreshMs = Number(refresh) * 1000;
    if (!api || !refreshMs || !window.OverlayFields) return;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const all = (selector) => document.querySelectorAll(selector);
    let lastSignature = null;

    function apply(fields) {
        all('[data-field]').forEach((el) => {
            const value = fields.text[el.dataset.field];
            if (value !== undefined && el.textContent !== value) el.textContent = value;
        });
        all('[data-show]').forEach((el) => { el.hidden = !fields.visible[el.dataset.show]; });
        all('[data-sign]').forEach((el) => {
            const sign = fields.sign[el.dataset.sign];
            el.classList.toggle('up', sign === 'up');
            el.classList.toggle('down', sign === 'down');
        });
        all('[data-rank-icon]').forEach((el) => {
            if (fields.rankIcon && el.getAttribute('src') !== fields.rankIcon) {
                el.src = fields.rankIcon;
                el.alt = fields.rankName;
            }
        });
        document.body.classList.toggle('is-stale', fields.visible.stale);
    }

    async function render(fields) {
        const signature = JSON.stringify({ ...fields, visible: { ...fields.visible, stale: false } });
        if (lastSignature === null) {
            lastSignature = signature;
            apply(fields);
            return;
        }
        if (signature === lastSignature) {
            document.body.classList.toggle('is-stale', fields.visible.stale);
            return;
        }
        lastSignature = signature;
        document.body.classList.add('is-updating');
        await wait(FADE_MS);
        apply(fields);
        document.body.classList.remove('is-updating');
    }

    async function tick() {
        let delay = refreshMs;
        try {
            const response = await fetch(api, { cache: 'no-store' });
            const payload = await response.json();
            if (!payload.success) {
                delay = Math.max(refreshMs, (payload.retryAfterSeconds || 0) * 1000);
                throw new Error(payload.error || `HTTP ${response.status}`);
            }
            // La page affichait une erreur : on la recharge pour retrouver la mise en page complète.
            if (state === 'error') {
                window.location.reload();
                return;
            }
            await render(window.OverlayFields.computeFields(payload.data));
        } catch (error) {
            // On garde les dernières valeurs affichées et on réessaie au prochain cycle.
            console.warn('[overlay] mise à jour impossible :', error.message);
        }
        setTimeout(tick, delay);
    }

    setTimeout(tick, refreshMs);
})();
