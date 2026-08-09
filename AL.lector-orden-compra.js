(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
    const norm = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    function monthNumber(name) {
        const months = { ene:'01', feb:'02', mar:'03', abr:'04', may:'05', jun:'06', jul:'07', ago:'08', sep:'09', sept:'09', oct:'10', nov:'11', dic:'12' };
        return months[norm(name).slice(0,4)] || months[norm(name).slice(0,3)] || '';
    }

    function toIsoDate(value) {
        const raw = clean(value);
        let match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
        if (match) {
            let year = Number(match[3]);
            if (year < 100) year += 2000;
            return `${year}-${String(match[2]).padStart(2,'0')}-${String(match[1]).padStart(2,'0')}`;
        }
        match = raw.match(/^(\d{1,2})[\/-]([A-Za-zÁÉÍÓÚáéíóú]{3,5})[\/-](\d{2,4})$/);
        if (match) {
            let year = Number(match[3]);
            if (year < 100) year += 2000;
            const month = monthNumber(match[2]);
            if (month) return `${year}-${month}-${String(match[1]).padStart(2,'0')}`;
        }
        return '';
    }

    function nearestBelow(items, label) {
        if (!label) return '';
        const candidates = items.filter(item => {
            const vertical = label.y - item.y;
            return vertical > 2 && vertical < 45 && Math.abs(item.x - label.x) < 90 && clean(item.str);
        }).sort((a,b) => {
            const av = Math.abs((label.y-a.y));
            const bv = Math.abs((label.y-b.y));
            return av-bv || Math.abs(label.x-a.x)-Math.abs(label.x-b.x);
        });
        return clean(candidates[0]?.str);
    }

    function parseOrder(items) {
        const tokens = items.map(item => clean(item.str)).filter(Boolean);
        const normalized = tokens.map(norm);
        const orderLabelIndex = normalized.findIndex(t => t === 'orden de compra' || t.startsWith('orden de compra'));
        const dateLabelIndex = normalized.findIndex(t => t === 'fecha');
        const refLabelIndex = normalized.findIndex(t => t === 'referencia');
        const orderLabel = items.find(item => norm(item.str) === 'orden de compra' || norm(item.str).startsWith('orden de compra'));
        const dateLabel = items.find(item => norm(item.str) === 'fecha');
        const refLabel = items.find(item => norm(item.str) === 'referencia');

        let order = nearestBelow(items, orderLabel);
        let date = nearestBelow(items, dateLabel);
        let reference = nearestBelow(items, refLabel);

        const dateRegex = /^\d{1,2}[\/-](?:\d{1,2}|[A-Za-zÁÉÍÓÚáéíóú]{3,5})[\/-]\d{2,4}$/;
        const dateIndex = tokens.findIndex(token => dateRegex.test(token));
        if (!date && dateIndex >= 0) date = tokens[dateIndex];

        const lastLabel = Math.max(orderLabelIndex, dateLabelIndex, refLabelIndex);
        if (!order && lastLabel >= 0 && dateIndex > lastLabel) {
            order = clean(tokens.slice(lastLabel + 1, dateIndex).join(' '));
        }
        if (!reference && dateIndex >= 0) {
            reference = clean(tokens.slice(dateIndex + 1).find(token => /^[A-Z0-9][A-Z0-9._\/-]*$/i.test(token)) || '');
        }

        const joined = clean(tokens.join(' '));
        if (!order || !date || !reference) {
            const block = joined.match(/orden de compra\s+fecha\s+referencia\s+(.+?)\s+(\d{1,2}[\/-](?:\d{1,2}|[a-záéíóú]{3,5})[\/-]\d{2,4})\s+([a-z0-9._\/-]+)/i);
            if (block) {
                order ||= clean(block[1]);
                date ||= clean(block[2]);
                reference ||= clean(block[3]);
            }
        }

        return { order: clean(order), date: clean(date), reference: clean(reference), isoDate: toIsoDate(date) };
    }

    async function extractPdf(file) {
        if (!window.pdfjsLib) throw new Error('No se cargó el lector PDF. Recarga la página con Ctrl + F5.');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const items = [];
        const maxPages = Math.min(pdf.numPages, 3);
        for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            content.items.forEach(item => items.push({
                str: item.str,
                x: Number(item.transform?.[4] || 0),
                y: Number(item.transform?.[5] || 0),
                page: pageNumber
            }));
        }
        return parseOrder(items);
    }

    function applyData(data) {
        const orderInputs = [$('entrada-orden-materiales'), $('orden_compra_val')].filter(Boolean);
        orderInputs.forEach(input => { if (data.order) input.value = data.order; });
        if ($('fecha_orden_compra_val') && data.isoDate) $('fecha_orden_compra_val').value = data.isoDate;
        if ($('referencia_movimiento_val') && data.reference) $('referencia_movimiento_val').value = data.reference;
        $('oc-preview-order').textContent = data.order || 'No detectada';
        $('oc-preview-date').textContent = data.date || 'No detectada';
        $('oc-preview-reference').textContent = data.reference || 'No detectada';
    }

    function inject() {
        if ($('lector-oc-v126')) return true;
        const anchor = $('entrada-orden-materiales-wrap') || $('panel-datos-entrada-v122') || $('documentos-movimiento-v125');
        if (!anchor) return false;
        const section = document.createElement('section');
        section.id = 'lector-oc-v126';
        section.className = 'rounded-xl border border-blue-500/20 bg-blue-950/10 p-4 space-y-3';
        section.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h4 class="text-xs font-bold text-blue-200">Lector de orden de compra</h4>
                    <p class="text-[10px] text-gray-500 mt-1">Para pruebas lee únicamente orden de compra, fecha y referencia del PDF.</p>
                </div>
                <label class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer">
                    Leer PDF
                    <input id="oc-pdf-input" type="file" accept="application/pdf,.pdf" class="hidden">
                </label>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div class="rounded-lg border border-[#243257] bg-[#060a14] p-3"><span class="block text-[9px] uppercase tracking-wider text-gray-500">Orden de compra</span><strong id="oc-preview-order" class="block mt-1 text-white">Sin leer</strong></div>
                <div class="rounded-lg border border-[#243257] bg-[#060a14] p-3"><span class="block text-[9px] uppercase tracking-wider text-gray-500">Fecha</span><strong id="oc-preview-date" class="block mt-1 text-white">Sin leer</strong></div>
                <div class="rounded-lg border border-[#243257] bg-[#060a14] p-3"><span class="block text-[9px] uppercase tracking-wider text-gray-500">Referencia</span><strong id="oc-preview-reference" class="block mt-1 text-white">Sin leer</strong></div>
            </div>
            <p id="oc-reader-status" class="text-[10px] text-gray-500">Los datos detectados se colocarán en los campos editables del movimiento.</p>`;
        anchor.insertAdjacentElement('afterend', section);
        $('oc-pdf-input').addEventListener('change', async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const status = $('oc-reader-status');
            status.textContent = 'Leyendo orden de compra...';
            status.className = 'text-[10px] text-blue-300';
            try {
                const data = await extractPdf(file);
                applyData(data);
                if (!data.order || !data.date || !data.reference) {
                    status.textContent = 'La lectura fue parcial. Revisa y completa manualmente los campos.';
                    status.className = 'text-[10px] text-amber-300';
                } else {
                    status.textContent = 'Orden leída correctamente. Puedes corregir cualquier dato antes de guardar.';
                    status.className = 'text-[10px] text-emerald-300';
                }
            } catch (error) {
                status.textContent = `No se pudo leer el PDF: ${error.message}`;
                status.className = 'text-[10px] text-rose-300';
            } finally {
                event.target.value = '';
            }
        });
        return true;
    }

    const oldChangeType = window.cambiarTipo;
    if (typeof oldChangeType === 'function') {
        window.cambiarTipo = function (type) {
            const result = oldChangeType(type);
            setTimeout(() => {
                inject();
                $('lector-oc-v126')?.classList.toggle('hidden', type !== 'entrada');
            }, 20);
            return result;
        };
    }

    const timer = setInterval(() => {
        if (inject()) {
            clearInterval(timer);
            $('lector-oc-v126')?.classList.toggle('hidden', window.currentType && window.currentType !== 'entrada');
        }
    }, 200);
    setTimeout(() => clearInterval(timer), 12000);
})();
