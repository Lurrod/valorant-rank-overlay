// Accueil : construit l'URL de l'overlay à partir du formulaire et l'affiche en aperçu.
(() => {
    const COPIED_MS = 1800;
    const COPY_LABEL = "Copier l'URL";

    const form = document.getElementById('overlay-form');
    const output = document.getElementById('url-output');
    const urlEl = document.getElementById('overlay-url');
    const hint = document.getElementById('form-hint');
    const copyBtn = document.getElementById('copy-btn');
    const previewBtn = document.getElementById('preview-btn');
    const preview = document.getElementById('preview');
    const frame = document.getElementById('preview-frame');

    let sessionStart = null;

    function readForm() {
        const values = new FormData(form);
        return {
            name: String(values.get('name') || '').trim(),
            tag: String(values.get('tag') || '').trim().replace(/^#/, ''),
            region: String(values.get('region') || ''),
            platform: String(values.get('platform') || 'pc'),
            style: String(values.get('style') || ''),
            session: values.get('session') === 'on'
        };
    }

    function buildPath({ name, tag, region, platform, style, session }) {
        const segments = [style, name, tag, region].map(encodeURIComponent).join('/');
        const query = new URLSearchParams();
        if (session) query.set('since', String(sessionStart));
        if (platform !== 'pc') query.set('platform', platform);
        const queryString = query.toString();
        return `/overlay/${segments}${queryString ? `?${queryString}` : ''}`;
    }

    function update() {
        const values = readForm();
        sessionStart = values.session ? (sessionStart ?? Date.now()) : null;

        const ready = values.name.length > 0 && values.tag.length > 0;
        output.hidden = !ready;
        hint.hidden = ready;
        if (ready) urlEl.textContent = `${window.location.origin}${buildPath(values)}`;
    }

    async function copyUrl() {
        try {
            await navigator.clipboard.writeText(urlEl.textContent);
            copyBtn.textContent = 'Copiée';
        } catch {
            copyBtn.textContent = 'Copie manuelle nécessaire';
        }
        setTimeout(() => { copyBtn.textContent = COPY_LABEL; }, COPIED_MS);
    }

    function showPreview() {
        frame.src = buildPath(readForm());
        preview.hidden = false;
    }

    form.addEventListener('input', update);
    form.addEventListener('submit', (event) => event.preventDefault());
    copyBtn.addEventListener('click', copyUrl);
    previewBtn.addEventListener('click', showPreview);
    update();
})();
