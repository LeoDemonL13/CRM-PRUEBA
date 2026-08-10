(function () {
    'use strict';

    const STOP_WORDS = new Set([
        'a','al','algo','ante','bajo','cada','como','con','contra','cual','cuales','de','del','desde','donde','el','ella','en','entre','es','ese','esta','este','esto','hay','la','las','lo','los','me','mi','para','por','que','se','sin','sobre','su','sus','un','una','unos','unas','y','o',
        'buscar','busca','buscame','muestra','mostrar','ver','quiero','necesito','dame','checa','checame','revisa','revisame','encuentra','encontrar'
    ]);

    const WORD_GROUPS = [
        ['pija','pijas','tornillo','tornillos','autotaladrante','autotaladrantes','autorroscante','autorroscantes'],
        ['tubo','tubos','tuberia','tuberias','conduit'],
        ['cincho','cinchos','cintillo','cintillos','tyrap','tyraps','tie','wrap'],
        ['desarmador','desarmadores','destornillador','destornilladores'],
        ['esmeril','esmeriles','amoladora','amoladoras'],
        ['montacargas','forklift'],
        ['camioneta','pickup','troca'],
        ['automovil','auto','carro','coche'],
        ['cable','conductor','conductores'],
        ['contacto','tomacorriente','receptaculo'],
        ['apagador','interruptor'],
        ['foco','lampara','luminaria'],
        ['cople','copla','union'],
        ['abrazadera','abrazaderas','grapa','grapas'],
        ['rondana','rondanas','arandela','arandelas'],
        ['tuerca','tuercas','nut'],
        ['broca','brocas','mecha','mechas'],
        ['casco','cascos','yelmo'],
        ['lentes','gafas','anteojos'],
        ['chaleco','chalecos'],
        ['guante','guantes'],
        ['bota','botas','calzado'],
        ['almacen','bodega'],
        ['herramienta','herramientas','hta'],
        ['orden','oc'],
        ['proyecto','proy'],
        ['proveedor','prov']
    ];

    const ALIAS_MAP = new Map();
    WORD_GROUPS.forEach(group => {
        const normalized = group.map(normalizeWord);
        normalized.forEach(word => ALIAS_MAP.set(word, normalized));
    });

    const FRACTIONS = {
        '¼':'1/4','½':'1/2','¾':'3/4','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8',
        '⅓':'1/3','⅔':'2/3','⅕':'1/5','⅖':'2/5','⅗':'3/5','⅘':'4/5','⅙':'1/6','⅚':'5/6'
    };

    const GAUGE_EQUIVALENTS = new Map([
        ['#14','1/4'],
        ['#12','7/32'],
        ['#10','3/16'],
        ['#8','5/32'],
        ['#6','9/64']
    ]);

    const WORD_NUMBERS = [
        [/\bun cuarto\b/g,'1/4'],[/\bcuarto de pulgada\b/g,'1/4'],[/\bmedia pulgada\b/g,'1/2'],[/\bmedio pulgada\b/g,'1/2'],
        [/\btres cuartos\b/g,'3/4'],[/\bun medio\b/g,'1/2'],[/\buna pulgada\b/g,'1'],[/\buna y media\b/g,'1 1/2']
    ];

    function stripAccents(value) {
        return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function normalizeWord(value) {
        return stripAccents(value).toLowerCase().trim();
    }

    function normalize(value) {
        let text = String(value ?? '');
        Object.entries(FRACTIONS).forEach(([symbol, fraction]) => { text = text.split(symbol).join(fraction); });
        text = stripAccents(text)
            .toLowerCase()
            .replace(/[“”„‟″]/g, '"')
            .replace(/[‘’´`]/g, "'")
            .replace(/[×✕✖·]/g, 'x');
        WORD_NUMBERS.forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
        text = text
            .replace(/\b(pulgadas?|pulg\.?|inches?|inch)\b/g, ' ')
            .replace(/\b(numero|num\.?|nro\.?|no\.?|calibre)\s*#?\s*(\d+)/g, '#$2')
            .replace(/\s*[xX]\s*/g, 'x')
            .replace(/\s*\/\s*/g, '/')
            .replace(/#\s+/g, '#')
            .replace(/(\d)\s*"/g, '$1')
            .replace(/[^a-z0-9#\/\.x\-\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return text;
    }

    function compact(value) {
        return normalize(value).replace(/[^a-z0-9#\/\.x]/g, '');
    }

    function fractionDecimal(value) {
        const part = String(value || '');
        if (/^\d+\/\d+$/.test(part)) {
            const [a,b] = part.split('/').map(Number);
            return b ? a / b : NaN;
        }
        const number = Number(part);
        return Number.isFinite(number) ? number : NaN;
    }

    function canonicalNumber(value) {
        const n = fractionDecimal(value);
        if (!Number.isFinite(n)) return String(value || '');
        const rounded = Math.round(n * 10000) / 10000;
        return String(rounded).replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1');
    }

    function dimensionSignatures(value) {
        const text = normalize(value);
        const signatures = new Set();
        const addPair = (width, length) => {
            const w = canonicalNumber(width);
            const l = canonicalNumber(length);
            if (w && l) signatures.add(`${w}x${l}`);
        };

        const gaugePattern = /#(\d{1,2})(?:x|\s+x\s+)(\d+(?:\.\d+)?|\d+\/\d+)/g;
        let match;
        while ((match = gaugePattern.exec(text))) {
            const gauge = `#${match[1]}`;
            const len = match[2];
            signatures.add(`${gauge}x${canonicalNumber(len)}`);
            const equivalent = GAUGE_EQUIVALENTS.get(gauge);
            if (equivalent) addPair(equivalent, len);
        }

        const fractionPattern = /(?:^|\s|[^#\d])(\d+\/\d+|\d+(?:\.\d+)?)(?:x)(\d+(?:\.\d+)?|\d+\/\d+)/g;
        while ((match = fractionPattern.exec(text))) {
            addPair(match[1], match[2]);
            for (const [gauge, equivalent] of GAUGE_EQUIVALENTS.entries()) {
                const a = fractionDecimal(equivalent);
                const b = fractionDecimal(match[1]);
                if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.012) {
                    signatures.add(`${gauge}x${canonicalNumber(match[2])}`);
                }
            }
        }

        return signatures;
    }

    function rawTokens(value) {
        return normalize(value).split(/\s+/).map(token => token.replace(/^[-]+|[-]+$/g,'')).filter(Boolean);
    }

    function meaningfulTokens(value) {
        return rawTokens(value).filter(token => {
            if (/\d/.test(token) || token.includes('/') || token.includes('#')) return true;
            return token.length >= 2 && !STOP_WORDS.has(token);
        });
    }

    function tokenVariants(token) {
        const normalized = normalizeWord(token);
        const variants = new Set([normalized]);
        const group = ALIAS_MAP.get(normalized);
        if (group) group.forEach(item => variants.add(item));
        if (normalized.length > 3 && normalized.endsWith('s')) variants.add(normalized.slice(0,-1));
        if (normalized.length > 3 && !normalized.endsWith('s')) variants.add(`${normalized}s`);
        return [...variants];
    }

    function levenshtein(a, b, limit = 2) {
        if (a === b) return 0;
        if (Math.abs(a.length - b.length) > limit) return limit + 1;
        const previous = Array.from({length:b.length+1}, (_,i)=>i);
        for (let i=1;i<=a.length;i++) {
            let current = [i];
            let min = current[0];
            for (let j=1;j<=b.length;j++) {
                const cost = a[i-1] === b[j-1] ? 0 : 1;
                const value = Math.min(current[j-1]+1, previous[j]+1, previous[j-1]+cost);
                current[j] = value;
                if (value < min) min = value;
            }
            if (min > limit) return limit + 1;
            for (let j=0;j<current.length;j++) previous[j] = current[j];
        }
        return previous[b.length];
    }

    function tokenScore(targetTokens, targetNorm, token) {
        let best = -1;
        for (const variant of tokenVariants(token)) {
            if (!variant) continue;
            if (targetTokens.has(variant)) best = Math.max(best, 42);
            if (variant.length >= 3 && targetNorm.includes(variant)) best = Math.max(best, 30);
            if (variant.length >= 3) {
                for (const target of targetTokens) {
                    if (target.startsWith(variant) || variant.startsWith(target)) best = Math.max(best, 27);
                    if (variant.length >= 5 && target.length >= 5) {
                        const limit = variant.length >= 8 ? 2 : 1;
                        if (levenshtein(variant, target, limit) <= limit) best = Math.max(best, 20);
                    }
                }
            }
        }
        return best;
    }

    function score(values, query) {
        const targetSource = Array.isArray(values) ? values.flat(Infinity).filter(v=>v!=null).join(' ') : String(values ?? '');
        const qNorm = normalize(query);
        if (!qNorm) return 1;
        const tNorm = normalize(targetSource);
        if (!tNorm) return -1;
        const qCompact = compact(query);
        const tCompact = compact(targetSource);
        let total = 0;

        if (tNorm === qNorm) total += 220;
        else if (tNorm.includes(qNorm)) total += 155;
        if (qCompact.length >= 3 && tCompact.includes(qCompact)) total += 120;

        const qDimensions = dimensionSignatures(query);
        const tDimensions = dimensionSignatures(targetSource);
        if (qDimensions.size) {
            let dimensionHit = 0;
            qDimensions.forEach(sig => { if (tDimensions.has(sig)) dimensionHit += 1; });
            if (!dimensionHit) return -1;
            total += 85 + Math.max(0, dimensionHit - 1) * 18;
        }

        const queryTokens = meaningfulTokens(query).filter(token => !/^(?:\d+(?:\/\d+)?|#\d+)(?:x\d+(?:\/\d+)?)?$/.test(token));
        const targetTokens = new Set(rawTokens(targetSource));
        let hits = 0;
        queryTokens.forEach(token => {
            const part = tokenScore(targetTokens, tNorm, token);
            if (part >= 0) { hits += 1; total += part; }
        });
        if (queryTokens.length) {
            const required = queryTokens.length <= 2 ? queryTokens.length : Math.ceil(queryTokens.length * 0.7);
            if (hits < required) return -1;
            if (hits === queryTokens.length) total += 35;
        }

        if (!queryTokens.length && !qDimensions.size && total <= 0) return -1;
        return total;
    }

    function matches(values, query) {
        return score(values, query) >= 0;
    }

    function rank(items, query, getter) {
        const source = Array.isArray(items) ? items : [];
        const get = typeof getter === 'function' ? getter : item => item;
        return source.map((item,index)=>({item,index,score:score(get(item),query)}))
            .filter(row=>row.score>=0)
            .sort((a,b)=>b.score-a.score || a.index-b.index)
            .map(row=>row.item);
    }

    function explain(query) {
        return {
            normalized: normalize(query),
            compact: compact(query),
            tokens: meaningfulTokens(query),
            dimensions: [...dimensionSignatures(query)]
        };
    }

    window.SkilledSearch = Object.freeze({ normalize, compact, score, matches, rank, explain, dimensionSignatures });
})();
