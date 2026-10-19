/*
    MesmoTools.jsx
    MESMO TOOLS - painel ScriptUI único para Adobe After Effects.

    Abas:
    - Animação = Curvas + Explode (juntos na mesma tela)
    - Camadas = Criar + Anchor Point + Extract + Batidas
    - Comps = Ajustes + Duplicar + 3D / Blur (juntos na mesma tela)
    - Expressões: atalhos prontos + suas expressões favoritas

    Arquivos salvos em Folder.userData/MesmoTools/:
    - speed_curves.txt          (curvas)
    - expression_favorites.txt  (expressões)

    v2.0
    - Tudo num arquivo só: MesmoTools.jsx (antigo CompManager_Mesmo.jsx).
    - Visual novo: cabeçalho, navegação e botões desenhados, seções no
      lugar das caixas, aba aberta por último é lembrada.
    - Nova aba Curvas: 22 curvas prontas num dropdown (favoritas no topo,
      separadas por categoria) e editor ao vivo: escolher uma curva,
      arrastar as alças ou digitar os valores já muda as keyframes
      selecionadas na timeline.
    - Explode: recusa texto vertical/justificado (como o avulso fazia) e
      expõe explodeMesmo(options) para outros scripts.
    - Visual: destaque lilás; 3 abas principais (Animação, Comps,
      Expressões) que mostram todas as ferramentas ao mesmo tempo:
      lado a lado no painel largo, empilhadas no estreito (botão ⇆ força
      um modo); cada ferramenta recolhe/expande pelo cabeçalho;
      editor de curva quadrado e compacto.
    - Novo painel Camadas: criar Texto/Adjustment/Null/Sólido/Shape/
      Câmera/Luz; Null no atributo (null no ponto exato, linkado, nome
      "Camada-position-null"); grade 3x3 de Anchor Point; Extract de
      grupos de shape; marcadores nas batidas do áudio.
    - Curvas: modo Velocidade (speed graph) no editor; arrastar para fora
      do editor solta a alça; campos acompanham a largura do painel.
    - Desempenho: recolher/expandir e trocar de aba recalculam só a aba
      ativa; medidas de texto em cache; resize mais leve.
    - Barra de rolagem: o painel pode ficar pequeno e o conteúdo rola
      (cabeçalho e abas fixos); cada aba rola só o próprio conteúdo.
    - 3D/Blur: liga/desliga Motion Blur em todas as camadas possíveis
      (e a chave da comp); usa a comp aberta se nada estiver selecionado.
    - Expressões: 18 atalhos do repositório After-effects-Expressions,
      com descrição, "Aplicar em" e tutorial em comentário; filtro por
      categoria; cria o Slider Control quando a expressão precisa.
    - Duplicar: pasta da cópia com a comp principal + subpasta
      PRECOMPS_<sufixo> com as precomps; nome da pasta sai do sufixo
      quando vazio; prévia do resultado; lembra as opções.

    v1.1
    - Comps: timecode em 23,976 / 29,97 / 59,94 não perde mais frames
      ao ler e reaplicar a duração; aceita também "10s" e "250f".
    - Duplica: precomps repetidas são duplicadas uma vez só por cópia;
      com várias cópias, as comps do topo são numeradas.
    - Explode: layer auxiliar sempre removida; a original nunca é excluída
      se alguma peça falhar; as peças novas ficam selecionadas.
    - 3D: ignora câmeras, luzes e layers de áudio; conta só o que mudou.
    - Expressions: avisa quando a expressão aplicada dá erro no AE.
    - Comps: resumo da seleção atualiza ao voltar para a aba.
*/

(function MesmoTools(thisObj) {

    var SCRIPT_NAME = "Mesmo Tools";
    var SCRIPT_VERSION = "2.0";
    var suppressResizeSync = false;
    var lockedRatio = 16 / 9;

    function trimString(s) {
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function isComp(item) {
        return item && (item instanceof CompItem);
    }

    function getSelectedComps() {
        var out = [];
        if (!app.project) return out;

        var sel = app.project.selection;
        for (var i = 0; i < sel.length; i++) {
            if (isComp(sel[i])) out.push(sel[i]);
        }
        return out;
    }

    function pad2(n) {
        n = Math.floor(Math.abs(n));
        return (n < 10 ? "0" : "") + n;
    }

    function parseLocalizedNumber(s) {
        return parseFloat(trimString(s).replace(",", "."));
    }

    function isValidCustomFPSString(s) {
        return /^\d+([.,]\d{1,2})?$/.test(trimString(s));
    }

    function addStatus(parent, text) {
        var status = parent.add("statictext", undefined, text || "");
        status.alignment = ["fill", "top"];
        status.preferredSize.width = 40;
        uiColorText(status, THEME.textDim);
        return status;
    }

    // ================================================================
    // UI KIT — visual do Mesmo Tools
    // Tudo é desenhado com onDraw do ScriptUI: botões, navegação, seções.
    // Para mudar a cara do painel, comece pelas cores em THEME.
    // ================================================================

    var THEME = {
        accent:       [0.73, 0.60, 0.98, 1],  // lilás #BA99FA
        accentHover:  [0.82, 0.72, 1.00, 1],
        accentDown:   [0.60, 0.47, 0.86, 1],
        accentSoft:   [0.73, 0.60, 0.98, 0.25],
        text:         [0.91, 0.90, 0.94, 1],
        textDim:      [0.60, 0.58, 0.66, 1],
        textOnAccent: [0.11, 0.08, 0.17, 1],
        surface:      [0.22, 0.21, 0.25, 1],
        surfaceHover: [0.28, 0.26, 0.32, 1],
        surfaceDown:  [0.16, 0.15, 0.19, 1],
        well:         [0.13, 0.12, 0.15, 1],
        line:         [0.32, 0.30, 0.37, 1],
        grid:         [0.19, 0.18, 0.22, 1]
    };

    var FONT_CACHE = {};

    function uiFont(style, size) {
        var key = style + "_" + size;

        if (FONT_CACHE[key] === undefined) {
            try {
                FONT_CACHE[key] = ScriptUI.newFont(
                    "dialog",
                    ScriptUI.FontStyle[style] || ScriptUI.FontStyle.REGULAR,
                    size
                );
            } catch (e) {
                FONT_CACHE[key] = null;
            }
        }

        return FONT_CACHE[key];
    }

    function uiBrush(g, c) {
        return g.newBrush(g.BrushType.SOLID_COLOR, c);
    }

    function uiPen(g, c, w) {
        return g.newPen(g.PenType.SOLID_COLOR, c, w || 1);
    }

    function uiRoundRect(g, x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        g.newPath();

        if (r < 1) {
            g.rectPath(x, y, w, h);
            return;
        }

        var corners = [
            [x + w - r, y + r, -90],
            [x + w - r, y + h - r, 0],
            [x + r, y + h - r, 90],
            [x + r, y + r, 180]
        ];
        var steps = 2;
        var first = true;

        for (var c = 0; c < corners.length; c++) {
            for (var i = 0; i <= steps; i++) {
                var a = (corners[c][2] + 90 * i / steps) * Math.PI / 180;
                var px = corners[c][0] + r * Math.cos(a);
                var py = corners[c][1] + r * Math.sin(a);

                if (first) {
                    g.moveTo(px, py);
                    first = false;
                } else {
                    g.lineTo(px, py);
                }
            }
        }

        g.closePath();
    }

    // Medir texto é caro no ScriptUI: guarda o resultado por fonte + texto.
    var MEASURE_CACHE = {};
    var MEASURE_COUNT = 0;

    function uiMeasure(g, s, font) {
        var key = (font ? (font.name + font.size + font.style) : "") + "|" + s;
        var hit = MEASURE_CACHE[key];
        if (hit) return hit;

        var m = g.measureString(s, font);
        hit = [m[0], m[1]];

        if (MEASURE_COUNT > 2000) {
            MEASURE_CACHE = {};
            MEASURE_COUNT = 0;
        }
        MEASURE_CACHE[key] = hit;
        MEASURE_COUNT++;
        return hit;
    }

    function uiFit(g, s, font, maxW) {
        s = String(s);
        if (maxW <= 0) return "";
        if (uiMeasure(g, s, font)[0] <= maxW) return s;

        while (s.length > 1 && uiMeasure(g, s + "…", font)[0] > maxW) {
            s = s.substring(0, s.length - 1);
        }

        return s + "…";
    }

    function uiText(g, s, font, color, x, y, w, h, align) {
        var sz = uiMeasure(g, s, font);
        var tx = x + (w - sz[0]) / 2;

        if (align === "left") tx = x;
        else if (align === "right") tx = x + w - sz[0];

        g.drawString(s, uiPen(g, color), tx, y + (h - sz[1]) / 2, font);
    }

    // Força o ScriptUI a chamar onDraw de novo.
    function uiRedraw(el) {
        try {
            el.hide();
            el.show();
        } catch (e) {}
    }

    function uiColorText(st, color) {
        try {
            st.graphics.foregroundColor = st.graphics.newPen(
                st.graphics.PenType.SOLID_COLOR,
                color,
                1
            );
        } catch (e) {}
        return st;
    }

    /*
        Deixa o elemento encolher/esticar com o painel: sem largura mínima
        vinda do texto, ele ocupa o espaço que sobrar na linha.
    */
    function uiFlex(el, minW) {
        try {
            el.preferredSize.width = minW || 40;
            el.alignment = ["fill", el.alignment && el.alignment[1] ? el.alignment[1] : "center"];
        } catch (e) {}
        return el;
    }

    function uiLabel(parent, text) {
        return uiColorText(parent.add("statictext", undefined, text), THEME.textDim);
    }

    /*
        Botão desenhado.
        opts.primary: botão de ação principal (laranja)
        opts.width / opts.height / opts.tip
    */
    function uiButton(parent, label, opts) {
        opts = opts || {};

        var b = parent.add("button", undefined, label);
        b.mesmoPrimary = !!opts.primary;
        b.preferredSize.height = opts.height || (opts.primary ? 32 : 24);

        if (opts.width) b.preferredSize.width = opts.width;
        if (opts.tip) b.helpTip = opts.tip;

        b.onDraw = function (state) {
            var g = this.graphics;
            var w = this.size[0];
            var h = this.size[1];
            var bg;
            var fg;

            if (!this.enabled) {
                bg = THEME.surfaceDown;
                fg = THEME.textDim;
            } else if (this.mesmoPrimary) {
                bg = state.leftButtonPressed
                    ? THEME.accentDown
                    : (state.mouseOver ? THEME.accentHover : THEME.accent);
                fg = THEME.textOnAccent;
            } else {
                bg = state.leftButtonPressed
                    ? THEME.surfaceDown
                    : (state.mouseOver ? THEME.surfaceHover : THEME.surface);
                fg = THEME.text;
            }

            uiRoundRect(g, 0, 0, w, h, 4);
            g.fillPath(uiBrush(g, bg));

            if (!this.mesmoPrimary) {
                uiRoundRect(g, 0.5, 0.5, w - 1, h - 1, 4);
                g.strokePath(uiPen(g, state.mouseOver ? THEME.textDim : THEME.line, 1));
            }

            var font = uiFont(this.mesmoPrimary ? "BOLD" : "REGULAR", this.mesmoPrimary ? 12 : 11);
            uiText(g, uiFit(g, this.text, font, w - 10), font, fg, 0, 0, w, h);
        };

        return b;
    }

    /*
        Seção com título em caixa alta, marcador laranja e linha fina.
        Devolve o grupo de conteúdo (use como se fosse um panel).
    */
    function uiSection(parent, title) {
        var wrap = parent.add("group");
        wrap.orientation = "column";
        wrap.alignment = ["fill", "top"];
        wrap.alignChildren = ["fill", "top"];
        wrap.spacing = 6;
        wrap.margins = [0, 4, 0, 0];

        var head = wrap.add("group");
        head.alignment = ["fill", "top"];
        head.preferredSize = [100, 16];
        head.mesmoTitle = String(title).toUpperCase();

        head.onDraw = function () {
            var g = this.graphics;
            var w = this.size[0];
            var h = this.size[1];
            var font = uiFont("BOLD", 10);
            var sz = uiMeasure(g, this.mesmoTitle, font);

            g.newPath();
            g.rectPath(0, Math.round((h - 9) / 2), 3, 9);
            g.fillPath(uiBrush(g, THEME.accent));

            g.drawString(this.mesmoTitle, uiPen(g, THEME.textDim), 9, (h - sz[1]) / 2, font);

            var lx = 9 + sz[0] + 8;
            if (lx < w) {
                var ly = Math.round(h / 2) + 0.5;
                g.newPath();
                g.moveTo(lx, ly);
                g.lineTo(w, ly);
                g.strokePath(uiPen(g, THEME.line, 1));
            }
        };

        var body = wrap.add("group");
        body.orientation = "column";
        body.alignment = ["fill", "top"];
        body.alignChildren = ["fill", "top"];
        body.spacing = 6;
        body.margins = [2, 0, 0, 0];

        return body;
    }

    function bezierPoint(c, t) {
        var mt = 1 - t;
        var a = 3 * mt * mt * t;
        var b = 3 * mt * t * t;
        var d = t * t * t;

        return [a * c.x1 + b * c.x2 + d, a * c.y1 + b * c.y2 + d];
    }

    function curveYRange(c) {
        var lo = 0;
        var hi = 1;

        for (var i = 0; i <= 24; i++) {
            var p = bezierPoint(c, i / 24);
            if (p[1] < lo) lo = p[1];
            if (p[1] > hi) hi = p[1];
        }

        return [lo, hi];
    }

    function uiStrokeCurve(g, c, x, y, w, h, range, color, width) {
        var lo = range[0];
        var span = (range[1] - range[0]) || 1;

        g.newPath();

        for (var i = 0; i <= 40; i++) {
            var p = bezierPoint(c, i / 40);
            var px = x + p[0] * w;
            var py = y + h - (p[1] - lo) / span * h;

            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
        }

        g.strokePath(uiPen(g, color, width));
    }

    function uiHeader(parent) {
        var head = parent.add("group");
        head.alignment = ["fill", "top"];
        head.preferredSize = [200, 30];

        var logoCurve = {x1: 0.7, y1: 0, x2: 0.3, y2: 1};

        head.onDraw = function () {
            var g = this.graphics;
            var w = this.size[0];
            var h = this.size[1];
            var fBold = uiFont("BOLD", 14);
            var fReg = uiFont("REGULAR", 14);
            var fSmall = uiFont("REGULAR", 10);
            var ly = Math.round((h - 20) / 2);

            uiRoundRect(g, 0, ly, 20, 20, 5);
            g.fillPath(uiBrush(g, THEME.accent));
            uiStrokeCurve(g, logoCurve, 4, ly + 4, 12, 12, [0, 1], THEME.textOnAccent, 2);

            var s1 = "MESMO";
            var sz1 = uiMeasure(g, s1, fBold);
            g.drawString(s1, uiPen(g, THEME.text), 28, (h - sz1[1]) / 2, fBold);
            g.drawString("TOOLS", uiPen(g, THEME.accent), 28 + sz1[0] + 4, (h - sz1[1]) / 2, fReg);

            var v = "v" + SCRIPT_VERSION;
            var sv = uiMeasure(g, v, fSmall);
            g.drawString(v, uiPen(g, THEME.textDim), w - sv[0] - 2, (h - sv[1]) / 2, fSmall);
        };

        return head;
    }

    /*
        Navegação principal. items: [{label, abbr, tip}]
        Quando o painel fica estreito, cada aba mostra o rótulo curto.
    */
    function uiNav(parent, items, onSelect) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignment = ["fill", "top"];
        row.alignChildren = ["fill", "fill"];
        row.spacing = 2;
        row.margins = 0;

        var nav = {buttons: [], index: 0};

        for (var i = 0; i < items.length; i++) {
            var b = row.add("button", undefined, items[i].label);
            b.mesmoShort = items[i].abbr || items[i].label;
            b.mesmoIndex = i;
            b.preferredSize = [30, 28];
            b.helpTip = items[i].tip || items[i].label;

            b.onDraw = function (state) {
                var g = this.graphics;
                var w = this.size[0];
                var h = this.size[1];
                var active = nav.index === this.mesmoIndex;

                if (active) {
                    uiRoundRect(g, 0, 0, w, h - 3, 3);
                    g.fillPath(uiBrush(g, THEME.surface));
                    g.newPath();
                    g.rectPath(0, h - 3, w, 3);
                    g.fillPath(uiBrush(g, THEME.accent));
                } else {
                    if (state.mouseOver) {
                        uiRoundRect(g, 0, 0, w, h - 3, 3);
                        g.fillPath(uiBrush(g, THEME.surfaceDown));
                    }
                    g.newPath();
                    g.rectPath(0, h - 1, w, 1);
                    g.fillPath(uiBrush(g, THEME.line));
                }

                var font = uiFont(active ? "BOLD" : "REGULAR", 11);
                var s = this.text;
                if (uiMeasure(g, s, font)[0] > w - 8) s = this.mesmoShort;

                uiText(
                    g,
                    uiFit(g, s, font, w - 4),
                    font,
                    (active || state.mouseOver) ? THEME.text : THEME.textDim,
                    0, 0, w, h - 3
                );
            };

            b.onClick = function () {
                nav.select(this.mesmoIndex);
            };

            nav.buttons.push(b);
        }

        nav.select = function (idx) {
            nav.index = idx;
            uiRedraw(row);
            if (onSelect) onSelect(idx);
        };

        return nav;
    }

    /*
        Cabeçalho de ferramenta (clicável): seta + título.
        Clique recolhe/expande o conteúdo da ferramenta.
    */
    function uiToolHeader(parent, title) {
        var b = parent.add("button", undefined, title);
        b.alignment = ["fill", "top"];
        b.preferredSize = [120, 26];
        b.mesmoOpen = true;
        b.helpTip = "Clique para recolher ou expandir";

        b.onDraw = function (state) {
            var g = this.graphics;
            var w = this.size[0];
            var h = this.size[1];

            uiRoundRect(g, 0, 0, w, h, 4);
            g.fillPath(uiBrush(g, state.mouseOver ? THEME.surfaceHover : THEME.surface));

            g.newPath();
            g.rectPath(0, 0, 3, h);
            g.fillPath(uiBrush(g, THEME.accent));

            // seta: ▼ aberto, ▶ fechado
            var cx = 13;
            var cy = h / 2;
            g.newPath();
            if (this.mesmoOpen) {
                g.moveTo(cx - 4, cy - 2);
                g.lineTo(cx + 4, cy - 2);
                g.lineTo(cx, cy + 3);
            } else {
                g.moveTo(cx - 2, cy - 4);
                g.lineTo(cx + 3, cy);
                g.lineTo(cx - 2, cy + 4);
            }
            g.closePath();
            g.fillPath(uiBrush(g, THEME.accent));

            var font = uiFont("BOLD", 12);
            uiText(g, uiFit(g, this.text.toUpperCase(), font, w - 32), font, THEME.text, 24, 0, w - 28, h, "left");
        };

        return b;
    }

    var SETTINGS_SECTION = "MesmoTools";

    function loadSetting(key, fallback) {
        try {
            if (app.settings.haveSetting(SETTINGS_SECTION, key)) {
                return app.settings.getSetting(SETTINGS_SECTION, key);
            }
        } catch (e) {}
        return fallback;
    }

    function saveSetting(key, value) {
        try {
            app.settings.saveSetting(SETTINGS_SECTION, key, String(value));
        } catch (e) {}
    }

    var WRITE_HELP =
        "\n\nConfira em Preferências > Scripting & Expressions se a opção " +
        "\"Allow Scripts to Write Files and Access Network\" está ativada.";


    /*
        Timecode non-drop-frame, igual ao After Effects:
        os campos contam frames NOMINAIS (30 para 29,97; 24 para 23,976...),
        e a duração real em segundos é totalFrames / fps.
        Formatar e ler usando a mesma base garante ida e volta sem perder frames.
    */
    function formatTimecode(seconds, fps) {
        if (seconds < 0) seconds = 0;

        var nominalFPS = Math.max(1, Math.round(fps));
        var totalFrames = Math.round(seconds * fps);

        var frames = totalFrames % nominalFPS;
        var totalSeconds = Math.floor(totalFrames / nominalFPS);
        var secs = totalSeconds % 60;
        var minsTotal = Math.floor(totalSeconds / 60);
        var mins = minsTotal % 60;
        var hours = Math.floor(minsTotal / 60);

        return hours + ":" + pad2(mins) + ":" + pad2(secs) + ":" + pad2(frames);
    }

    function parseTimecode(tc, fps) {
        tc = trimString(tc);

        var nominalFPS = Math.max(1, Math.round(fps));
        var totalFrames;

        // Atalhos: "10" ou "10s" = segundos; "250f" = frames.
        var mSec = tc.match(/^(\d+(?:[.,]\d+)?)\s*s?$/i);
        var mFrm = tc.match(/^(\d+)\s*f$/i);

        if (mFrm) {
            totalFrames = parseInt(mFrm[1], 10);
        } else if (mSec) {
            totalFrames = Math.round(parseLocalizedNumber(mSec[1]) * fps);
        } else {
            var m = tc.match(/^(\d+):([0-5]\d):([0-5]\d)[:;](\d{1,3})$/);
            if (!m) {
                throw new Error(
                    "Duração inválida. Use 0:00:00:00, segundos (10s) ou frames (250f)."
                );
            }

            var h = parseInt(m[1], 10);
            var min = parseInt(m[2], 10);
            var sec = parseInt(m[3], 10);
            var fr = parseInt(m[4], 10);

            if (fr >= nominalFPS) {
                throw new Error(
                    "O campo de frames (" + fr + ") precisa ser menor que " +
                    nominalFPS + " para " + fps + " fps."
                );
            }

            totalFrames = ((h * 3600) + (min * 60) + sec) * nominalFPS + fr;
        }

        var duration = totalFrames / fps;

        if (duration <= 0) {
            throw new Error("A duração precisa ser maior que zero.");
        }

        if (duration > 10800) {
            throw new Error("O After Effects limita composições a 3 horas.");
        }

        return duration;
    }

    function findRenderer(comp, friendlyName) {
        var available = comp.renderers;
        var candidates = [];

        if (friendlyName === "Classic 3D") {
            candidates = ["ADBE Advanced 3d", "ADBE Classic 3d", "Classic 3D"];
        } else if (friendlyName === "Advanced 3D") {
            candidates = ["ADBE Calder", "Advanced 3D"];
        } else if (friendlyName === "Cinema 4D") {
            candidates = ["ADBE Ernst", "ADBE Cinema 4d", "Cinema 4D"];
        }

        var i, j;
        for (i = 0; i < candidates.length; i++) {
            for (j = 0; j < available.length; j++) {
                if (available[j] === candidates[i]) return available[j];
            }
        }

        for (j = 0; j < available.length; j++) {
            var low = String(available[j]).toLowerCase();

            if (friendlyName === "Advanced 3D" && low.indexOf("calder") !== -1) {
                return available[j];
            }

            if (
                friendlyName === "Cinema 4D" &&
                (low.indexOf("ernst") !== -1 || low.indexOf("cinema") !== -1)
            ) {
                return available[j];
            }

            if (friendlyName === "Classic 3D" && low.indexOf("classic") !== -1) {
                return available[j];
            }
        }

        return null;
    }

    function rendererFriendlyName(internalName) {
        var s = String(internalName).toLowerCase();

        if (s === "adbe advanced 3d" || s.indexOf("classic") !== -1) {
            return "Classic 3D";
        }

        if (
            s === "adbe calder" ||
            (s.indexOf("advanced") !== -1 && s !== "adbe advanced 3d")
        ) {
            return "Advanced 3D";
        }

        if (s === "adbe ernst" || s.indexOf("cinema") !== -1) {
            return "Cinema 4D";
        }

        return null;
    }

    function buildCompsTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = [0, 6, 0, 0];

        var header = tab.add("group");
        header.orientation = "row";
        header.alignChildren = ["fill", "center"];

        var selectionText = uiFlex(header.add("statictext", undefined, "Selecione comps no Project."));

        var btnLoad = uiButton(header, "Ler 1ª Comp", {tip: "Carrega os valores da primeira comp selecionada"});

        var resizePanel = uiSection(tab, "Resolução");
        resizePanel.orientation = "column";
        resizePanel.alignChildren = ["fill", "top"];

        var cbResize = resizePanel.add("checkbox", undefined, "Aplicar Resize");

        var sizeRow = resizePanel.add("group");
        sizeRow.orientation = "row";
        sizeRow.alignChildren = ["left", "center"];

        uiLabel(sizeRow, "W:");
        var txtW = sizeRow.add("edittext", undefined, "1920");
        txtW.characters = 6;

        uiLabel(sizeRow, "H:");
        var txtH = sizeRow.add("edittext", undefined, "1080");
        txtH.characters = 6;

        uiLabel(sizeRow, "px");

        var cbLockRatio = resizePanel.add("checkbox", undefined, "Travar proporção");
        cbLockRatio.value = true;

        function updateLockedRatioFromFields() {
            var w = parseInt(txtW.text, 10);
            var h = parseInt(txtH.text, 10);
            if (w > 0 && h > 0) lockedRatio = w / h;
        }

        txtW.onChange = function () {
            if (suppressResizeSync || !cbLockRatio.value) return;
            var w = parseInt(txtW.text, 10);
            if (!isNaN(w) && w > 0 && lockedRatio > 0) {
                suppressResizeSync = true;
                txtH.text = String(Math.round(w / lockedRatio));
                suppressResizeSync = false;
            }
        };

        txtH.onChange = function () {
            if (suppressResizeSync || !cbLockRatio.value) return;
            var h = parseInt(txtH.text, 10);
            if (!isNaN(h) && h > 0 && lockedRatio > 0) {
                suppressResizeSync = true;
                txtW.text = String(Math.round(h * lockedRatio));
                suppressResizeSync = false;
            }
        };

        cbLockRatio.onClick = function () {
            if (cbLockRatio.value) updateLockedRatioFromFields();
        };

        updateLockedRatioFromFields();

        var fpsPanel = uiSection(tab, "Frame Rate");
        fpsPanel.orientation = "column";
        fpsPanel.alignChildren = ["fill", "top"];

        var cbFPS = fpsPanel.add("checkbox", undefined, "Aplicar Frame Rate");

        var fpsRow = fpsPanel.add("group");
        fpsRow.orientation = "row";
        fpsRow.alignChildren = ["left", "center"];

        uiLabel(fpsRow, "FPS:");

        var ddFPS = fpsRow.add(
            "dropdownlist",
            undefined,
            ["23,976", "24", "29,97", "30", "59,94", "60", "Custom"]
        );
        ddFPS.selection = 3;

        var txtCustomFPS = fpsRow.add("edittext", undefined, "30");
        txtCustomFPS.characters = 7;
        txtCustomFPS.enabled = false;

        function presetFPSFromIndex(index) {
            if (index === 0) return 23.976;
            if (index === 1) return 24;
            if (index === 2) return 29.97;
            if (index === 3) return 30;
            if (index === 4) return 59.94;
            if (index === 5) return 60;
            return null;
        }

        ddFPS.onChange = function () {
            var idx = ddFPS.selection ? ddFPS.selection.index : 3;
            var preset = presetFPSFromIndex(idx);
            txtCustomFPS.enabled = (preset === null);
            if (preset !== null) txtCustomFPS.text = String(preset).replace(".", ",");
        };

        function getRequestedFPS() {
            var idx = ddFPS.selection ? ddFPS.selection.index : 3;
            var preset = presetFPSFromIndex(idx);

            if (preset !== null) return preset;

            if (!isValidCustomFPSString(txtCustomFPS.text)) {
                throw new Error(
                    "FPS custom inválido. Use um valor de 4 a 300 com até 2 casas decimais."
                );
            }

            var fps = parseLocalizedNumber(txtCustomFPS.text);
            if (fps < 4 || fps > 300) {
                throw new Error("O FPS precisa estar entre 4 e 300.");
            }

            return fps;
        }

        var durationPanel = uiSection(tab, "Duração");
        durationPanel.orientation = "column";
        durationPanel.alignChildren = ["fill", "top"];

        var cbDuration = durationPanel.add("checkbox", undefined, "Aplicar Duração");

        var durationRow = durationPanel.add("group");
        durationRow.orientation = "row";
        durationRow.alignChildren = ["left", "center"];

        uiLabel(durationRow, "Tempo:");
        var txtDuration = durationRow.add("edittext", undefined, "0:00:10:00");
        uiFlex(txtDuration);
        uiLabel(durationRow, "ou 10s / 250f").helpTip = "Timecode H:MM:SS:FF, segundos (10s) ou frames (250f)";

        var rendererPanel = uiSection(tab, "Renderer 3D");
        rendererPanel.orientation = "column";
        rendererPanel.alignChildren = ["fill", "top"];

        var cbRenderer = rendererPanel.add("checkbox", undefined, "Aplicar 3D Renderer");

        var rendererRow = rendererPanel.add("group");
        rendererRow.orientation = "row";
        rendererRow.alignChildren = ["left", "center"];
        uiLabel(rendererRow, "Renderer:");

        var ddRenderer = rendererRow.add(
            "dropdownlist",
            undefined,
            ["Classic 3D", "Advanced 3D", "Cinema 4D"]
        );
        ddRenderer.selection = 0;

        var btnApply = uiButton(tab, "APLICAR NAS COMPS SELECIONADAS", {primary: true});

        var status = addStatus(tab, "Nenhuma alteração aplicada ainda.");

        function refreshSelectionText() {
            var comps = getSelectedComps();
            if (comps.length === 0) {
                selectionText.text = "Nenhuma composição selecionada.";
            } else if (comps.length === 1) {
                selectionText.text = "1 comp: " + comps[0].name;
            } else {
                selectionText.text = comps.length + " comps selecionadas.";
            }
        }

        function setFPSUI(fps) {
            var eps = 0.001;

            if (Math.abs(fps - 23.976) < eps) {
                ddFPS.selection = 0; txtCustomFPS.text = "23,976"; txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 24) < eps) {
                ddFPS.selection = 1; txtCustomFPS.text = "24"; txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 29.97) < eps) {
                ddFPS.selection = 2; txtCustomFPS.text = "29,97"; txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 30) < eps) {
                ddFPS.selection = 3; txtCustomFPS.text = "30"; txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 59.94) < eps) {
                ddFPS.selection = 4; txtCustomFPS.text = "59,94"; txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 60) < eps) {
                ddFPS.selection = 5; txtCustomFPS.text = "60"; txtCustomFPS.enabled = false;
            } else {
                ddFPS.selection = 6;
                txtCustomFPS.text = String(Math.round(fps * 100) / 100).replace(".", ",");
                txtCustomFPS.enabled = true;
            }
        }

        function setRendererUI(comp) {
            var friendly = rendererFriendlyName(comp.renderer);
            if (friendly === "Classic 3D") ddRenderer.selection = 0;
            else if (friendly === "Advanced 3D") ddRenderer.selection = 1;
            else if (friendly === "Cinema 4D") ddRenderer.selection = 2;
        }

        btnLoad.onClick = function () {
            var comps = getSelectedComps();

            if (comps.length === 0) {
                alert("Selecione pelo menos uma composição no painel Project.");
                return;
            }

            var comp = comps[0];

            suppressResizeSync = true;
            txtW.text = String(comp.width);
            txtH.text = String(comp.height);
            suppressResizeSync = false;

            updateLockedRatioFromFields();
            setFPSUI(comp.frameRate);
            txtDuration.text = formatTimecode(comp.duration, comp.frameRate);
            setRendererUI(comp);

            status.text = "Valores carregados de: " + comp.name;
            refreshSelectionText();
        };

        btnApply.onClick = function () {
            var comps = getSelectedComps();

            if (comps.length === 0) {
                alert("Selecione pelo menos uma composição no painel Project.");
                return;
            }

            if (!cbResize.value && !cbFPS.value && !cbDuration.value && !cbRenderer.value) {
                alert("Ative pelo menos uma opção para aplicar.");
                return;
            }

            var newW = null;
            var newH = null;
            var requestedFPS = null;
            var requestedRenderer = null;

            if (cbResize.value) {
                newW = parseInt(txtW.text, 10);
                newH = parseInt(txtH.text, 10);

                if (
                    isNaN(newW) || isNaN(newH) ||
                    newW < 4 || newH < 4 ||
                    newW > 30000 || newH > 30000
                ) {
                    alert("W e H precisam ser inteiros entre 4 e 30000 px.");
                    return;
                }
            }

            if (cbFPS.value) {
                try {
                    requestedFPS = getRequestedFPS();
                } catch (fpsErr) {
                    alert(fpsErr.toString().replace("Error: ", ""));
                    return;
                }
            }

            if (cbRenderer.value) {
                requestedRenderer = ddRenderer.selection
                    ? ddRenderer.selection.text
                    : "Classic 3D";
            }

            var success = 0;
            var errors = [];

            app.beginUndoGroup("Mesmo Tools - Comps");

            try {
                for (var i = 0; i < comps.length; i++) {
                    var comp = comps[i];

                    try {
                        if (cbResize.value) {
                            comp.width = newW;
                            comp.height = newH;
                        }

                        var fpsForDuration = comp.frameRate;

                        if (cbFPS.value) {
                            comp.frameRate = requestedFPS;
                            fpsForDuration = comp.frameRate;

                            if (Math.abs(comp.frameRate - requestedFPS) > 0.01) {
                                throw new Error(
                                    "O After Effects não aceitou " +
                                    requestedFPS + " fps nesta composição."
                                );
                            }
                        }

                        if (cbDuration.value) {
                            var durationSeconds = parseTimecode(
                                txtDuration.text,
                                fpsForDuration
                            );

                            comp.duration = durationSeconds;

                            try {
                                if (
                                    comp.workAreaStart +
                                    comp.workAreaDuration >
                                    comp.duration
                                ) {
                                    comp.workAreaStart = 0;
                                    comp.workAreaDuration = comp.duration;
                                }
                            } catch (workErr) {}
                        }

                        if (cbRenderer.value) {
                            var rendererInternal = findRenderer(comp, requestedRenderer);

                            if (!rendererInternal) {
                                throw new Error(
                                    requestedRenderer +
                                    " não está disponível nesta instalação do After Effects."
                                );
                            }

                            comp.renderer = rendererInternal;
                        }

                        success++;

                    } catch (compErr) {
                        errors.push(
                            comp.name + ": " +
                            compErr.toString().replace("Error: ", "")
                        );
                    }
                }
            } finally {
                app.endUndoGroup();
            }

            refreshSelectionText();

            if (errors.length === 0) {
                status.text =
                    success + " comp" + (success === 1 ? "" : "s") +
                    " atualizada" + (success === 1 ? "" : "s") + ".";
            } else {
                status.text =
                    success + " atualizada(s), " + errors.length + " com erro.";

                alert(
                    "Processo concluído com alguns erros:\n\n" +
                    errors.join("\n")
                );
            }
        };

        tab.addEventListener("mouseover", refreshSelectionText);
        refreshSelectionText();

        return {refresh: refreshSelectionText};
    }

    function buildDuplicaTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = [0, 6, 0, 0];

        var pnlNaming = uiSection(tab, "Nome das cópias");
        pnlNaming.orientation = "column";
        pnlNaming.alignChildren = ["fill", "top"];

        var grpSfx = pnlNaming.add("group");
        var cbSfx = grpSfx.add("checkbox", undefined, "");
        cbSfx.value = true;

        var ddType = grpSfx.add("dropdownlist", undefined, ["Sufixo", "Prefixo"]);
        ddType.selection = 0;

        var txtSfx = grpSfx.add("edittext", undefined, "_Copy");
        uiFlex(txtSfx);

        var grpSrch = pnlNaming.add("group");
        var cbSrch = grpSrch.add("checkbox", undefined, "Buscar");

        var txtSrch = grpSrch.add("edittext", undefined, "");
        uiFlex(txtSrch);

        uiLabel(grpSrch, "trocar por");

        var txtRpl = grpSrch.add("edittext", undefined, "");
        uiFlex(txtRpl);

        var pnlOpts = uiSection(tab, "Opções");
        pnlOpts.orientation = "column";
        pnlOpts.alignChildren = ["fill", "top"];

        var folderRow = pnlOpts.add("group");
        folderRow.orientation = "row";
        folderRow.alignChildren = ["fill", "center"];

        var cbFolder = folderRow.add("checkbox", undefined, "Organizar na pasta");
        var txtFolderName = folderRow.add("edittext", undefined, "");
        txtFolderName.alignment = ["fill", "center"];
        uiFlex(txtFolderName);
        txtFolderName.helpTip = "Vazio = usa o sufixo sem o \"_\" (ex.: _v02 vira v02)";

        var cbPrecompFolder = pnlOpts.add(
            "checkbox",
            undefined,
            "Separar as precomps numa subpasta PRECOMPS"
        );
        uiFlex(cbPrecompFolder);

        var previewText = uiFlex(uiLabel(pnlOpts, ""));

        var cbExp = pnlOpts.add("checkbox", undefined, "Atualizar expressões");

        // Lembra as escolhas entre sessões.
        cbSfx.value = loadSetting("dupNaming", "1") === "1";
        ddType.selection = loadSetting("dupNameMode", "0") === "1" ? 1 : 0;
        txtSfx.text = loadSetting("dupAffix", "_v02");
        cbFolder.value = loadSetting("dupFolderOn", "1") === "1";
        txtFolderName.text = loadSetting("dupFolderName", "");
        cbPrecompFolder.value = loadSetting("dupPrecompFolder", "1") === "1";
        cbExp.value = loadSetting("dupExpressions", "1") === "1";

        function rememberDupSettings() {
            saveSetting("dupNaming", cbSfx.value ? "1" : "0");
            saveSetting("dupNameMode", ddType.selection && ddType.selection.index === 1 ? "1" : "0");
            saveSetting("dupAffix", txtSfx.text);
            saveSetting("dupFolderOn", cbFolder.value ? "1" : "0");
            saveSetting("dupFolderName", txtFolderName.text);
            saveSetting("dupPrecompFolder", cbPrecompFolder.value ? "1" : "0");
            saveSetting("dupExpressions", cbExp.value ? "1" : "0");
        }

        function usingSuffix() {
            return cbSfx.value && txtSfx.text !== "" &&
                !(ddType.selection && ddType.selection.index === 1);
        }

        function usingPrefix() {
            return cbSfx.value && txtSfx.text !== "" &&
                ddType.selection && ddType.selection.index === 1;
        }

        // "_v02" -> "v02"; vazio -> "Cópias"
        function resolvedFolderName() {
            var name = trimString(txtFolderName.text);
            if (name !== "") return name;

            if (cbSfx.value) {
                name = trimString(txtSfx.text).replace(/^[\s_\-.]+|[\s_\-.]+$/g, "");
                if (name !== "") return name;
            }

            return "Cópias";
        }

        function precompFolderName() {
            if (usingSuffix()) return "PRECOMPS" + txtSfx.text;
            if (usingPrefix()) return txtSfx.text + "PRECOMPS";
            return "PRECOMPS";
        }

        function refreshDupUI() {
            txtFolderName.enabled = cbFolder.value;
            cbPrecompFolder.enabled = cbFolder.value;
            cbPrecompFolder.text = "Separar as precomps numa subpasta " + precompFolderName();

            var sel = app.project ? app.project.selection : [];
            var sample = "Comp";
            for (var i = 0; sel && i < sel.length; i++) {
                if (sel[i] instanceof CompItem) {
                    sample = sel[i].name;
                    break;
                }
            }

            var compName = processName(sample);

            if (!cbFolder.value) {
                previewText.text = "Resultado: " + compName + "  (na mesma pasta da original)";
            } else if (cbPrecompFolder.value) {
                previewText.text =
                    "Resultado:  [" + resolvedFolderName() + "]  →  " + compName +
                    "  +  [" + precompFolderName() + "]";
            } else {
                previewText.text =
                    "Resultado:  [" + resolvedFolderName() + "]  →  " + compName + " + precomps";
            }

            previewText.helpTip = previewText.text; // texto completo ao passar o mouse
        }

        cbFolder.onClick = refreshDupUI;
        cbPrecompFolder.onClick = refreshDupUI;
        cbSfx.onClick = refreshDupUI;
        ddType.onChange = refreshDupUI;
        txtSfx.onChanging = refreshDupUI;
        txtFolderName.onChanging = refreshDupUI;
        cbSrch.onClick = refreshDupUI;
        txtSrch.onChanging = refreshDupUI;
        txtRpl.onChanging = refreshDupUI;

        var bottomGrp = tab.add("group");
        bottomGrp.orientation = "row";
        bottomGrp.alignment = ["fill", "top"];

        uiLabel(bottomGrp, "Cópias:");

        var copyCount = bottomGrp.add("edittext", undefined, "1");
        copyCount.characters = 4;

        var btnRun = uiButton(bottomGrp, "DUPLICAR SELECIONADAS", {primary: true});
        btnRun.alignment = ["fill", "center"];

        var status = addStatus(tab, "Selecione uma ou mais comps no Project.");

        function processName(oldName) {
            var newName = oldName;

            if (cbSrch.value && txtSrch.text !== "") {
                newName = newName.split(txtSrch.text).join(txtRpl.text);
            }

            if (usingPrefix()) newName = txtSfx.text + newName;
            else if (usingSuffix()) newName = newName + txtSfx.text;

            return newName;
        }

        /*
            cache: { compId: cópia } compartilhado durante UMA cópia completa.
            Uma precomp usada em várias layers (ou em várias comps selecionadas)
            é duplicada uma única vez e reaproveitada.
        */
        /*
            folders.top     -> pasta da comp principal (ou null = fica onde o AE pôs)
            folders.nested() -> pasta das precomps (criada só quando precisar)
        */
        function deepDupe(item, folders, cache, nameOverride, isTop) {
            if (!(item instanceof CompItem)) return item;

            var key = "c" + item.id;
            if (cache[key]) return cache[key];

            var newItem = item.duplicate();
            newItem.name = nameOverride || processName(item.name);
            cache[key] = newItem;

            var dest = isTop ? folders.top : folders.nested();
            if (dest) newItem.parentFolder = dest;

            for (var i = 1; i <= newItem.numLayers; i++) {
                var curLayer = newItem.layer(i);

                try {
                    if (curLayer.source instanceof CompItem) {
                        curLayer.replaceSource(
                            deepDupe(curLayer.source, folders, cache, null, false),
                            cbExp.value
                        );
                    }
                } catch (e) {}
            }

            return newItem;
        }

        function makeFolders(baseName, parent) {
            var folders = {top: null, sub: null};

            if (!cbFolder.value) {
                folders.nested = function () { return null; };
                return folders;
            }

            folders.top = app.project.items.addFolder(baseName);
            try { folders.top.parentFolder = parent; } catch (eP) {}

            folders.nested = function () {
                if (!cbPrecompFolder.value) return folders.top;
                if (!folders.sub) {
                    folders.sub = app.project.items.addFolder(precompFolderName());
                    folders.sub.parentFolder = folders.top;
                }
                return folders.sub;
            };

            return folders;
        }

        btnRun.onClick = function () {
            if (!app.project) {
                alert("Nenhum projeto aberto.");
                return;
            }

            var sel = app.project.selection;

            if (!sel || sel.length === 0) {
                alert("Selecione pelo menos uma composição no Project.");
                return;
            }

            var num = parseInt(copyCount.text, 10);
            if (isNaN(num) || num < 1 || num > 999) {
                alert("Cópias precisa ser um número entre 1 e 999.");
                return;
            }

            var valid = [];
            for (var i = 0; i < sel.length; i++) {
                if (sel[i] instanceof CompItem) valid.push(sel[i]);
            }

            if (valid.length === 0) {
                alert("A seleção não contém composições.");
                return;
            }

            app.beginUndoGroup("Duplica Mesmo");

            var made = 0;
            var precomps = 0;
            var baseFolder = resolvedFolderName();
            var parentFolder = app.project.rootFolder;
            try { parentFolder = valid[0].parentFolder; } catch (eParent) {}

            rememberDupSettings();

            try {
                // Cada rodada de cópia tem o próprio cache e as próprias pastas.
                // Com mais de 1 cópia, comps e pastas do topo ganham número.
                for (var c = 0; c < num; c++) {
                    var cache = {};
                    var tag = num > 1 ? " " + (c + 1) : "";
                    var folders = makeFolders(baseFolder + tag, parentFolder);

                    for (i = 0; i < valid.length; i++) {
                        deepDupe(valid[i], folders, cache, processName(valid[i].name) + tag, true);
                        made++;
                    }

                    for (var k in cache) {
                        if (cache.hasOwnProperty(k)) precomps++;
                    }
                }
            } finally {
                app.endUndoGroup();
            }

            precomps -= made;

            status.text =
                made + " comp(s) duplicada(s)" +
                (precomps > 0 ? " + " + precomps + " precomp(s)" : "") +
                (cbFolder.value ? " em \"" + baseFolder + "\"" : "") + ".";
        };
        tab.addEventListener("mouseover", function () {
            try { refreshDupUI(); } catch (e) {}
        });
        refreshDupUI();

        return {refresh: refreshDupUI};
    }

    function isTextLayer(layer) {
        if (!layer) return false;

        try {
            return layer.property("ADBE Text Properties") !== null &&
                   layer.property("ADBE Text Properties")
                        .property("ADBE Text Document") !== null;
        } catch (e) {
            return false;
        }
    }

    function getSourceTextProp(layer) {
        return layer
            .property("ADBE Text Properties")
            .property("ADBE Text Document");
    }

    function getTextDocAtTime(layer, t) {
        var p = getSourceTextProp(layer);

        try {
            return p.valueAtTime(t, false);
        } catch (e) {
            return p.value;
        }
    }

    function hasCharacterRange(doc) {
        try {
            return doc && typeof doc.characterRange === "function";
        } catch (e) {
            return false;
        }
    }

    function hasComposedLineRange(doc) {
        try {
            return doc &&
                   typeof doc.composedLineRange === "function" &&
                   typeof doc.composedLineCount !== "undefined";
        } catch (e) {
            return false;
        }
    }

    function isWhitespaceOnly(s) {
        return /^\s*$/.test(s);
    }

    function isLineBreakChar(ch) {
        return ch === "\r" || ch === "\n";
    }

    function nextUnicodeCharEnd(s, i) {
        var c1 = s.charCodeAt(i);

        if (c1 >= 0xD800 && c1 <= 0xDBFF && i + 1 < s.length) {
            var c2 = s.charCodeAt(i + 1);
            if (c2 >= 0xDC00 && c2 <= 0xDFFF) return i + 2;
        }

        return i + 1;
    }

    function cloneRangeDoc(layer, t, startIndex, endIndex) {
        var doc = getTextDocAtTime(layer, t);
        var originalText = doc.text;

        startIndex = Math.max(0, Math.min(startIndex, originalText.length));
        endIndex = Math.max(startIndex, Math.min(endIndex, originalText.length));

        if (hasCharacterRange(doc)) {
            try {
                if (endIndex < originalText.length) {
                    doc.characterRange(endIndex, -1).text = "";
                }

                if (startIndex > 0) {
                    doc.characterRange(0, startIndex).text = "";
                }

                return doc;
            } catch (e1) {}
        }

        doc.text = originalText.substring(startIndex, endIndex);
        return doc;
    }

    function setStaticSourceText(layer, doc) {
        var prop = getSourceTextProp(layer);

        try {
            while (prop.numKeys > 0) prop.removeKey(prop.numKeys);
        } catch (e) {}

        try {
            prop.expression = "";
        } catch (e2) {}

        prop.setValue(doc);
    }

    function getBaselineStartAndEnd(layer) {
        var doc = getSourceTextProp(layer).value;
        var b = null;

        try {
            b = doc.baselineLocs;
        } catch (e) {}

        if (
            b &&
            b.length >= 4 &&
            Math.abs(b[0]) < 1e30 &&
            Math.abs(b[1]) < 1e30
        ) {
            return {
                start: [b[0], b[1]],
                end: [b[2], b[3]]
            };
        }

        var r = layer.sourceRectAtTime(layer.containingComp.time, false);

        return {
            start: [r.left, r.top + r.height],
            end: [r.left + r.width, r.top + r.height]
        };
    }

    function getLineRanges(doc) {
        var text = doc.text;
        var out = [];
        var i, range, s, e;

        if (hasComposedLineRange(doc)) {
            try {
                for (i = 0; i < doc.composedLineCount; i++) {
                    range = doc.composedLineRange(i, i + 1);
                    s = range.characterStart;
                    e = range.characterEnd;

                    while (e > s && isLineBreakChar(text.charAt(e - 1))) e--;
                    while (s < e && isLineBreakChar(text.charAt(s))) s++;

                    out.push({
                        start: s,
                        end: e,
                        lineIndex: i
                    });
                }

                return out;
            } catch (e1) {
                out = [];
            }
        }

        var start = 0;

        for (i = 0; i <= text.length; i++) {
            if (i === text.length || isLineBreakChar(text.charAt(i))) {
                out.push({
                    start: start,
                    end: i,
                    lineIndex: out.length
                });

                if (text.charAt(i) === "\r" && text.charAt(i + 1) === "\n") i++;
                start = i + 1;
            }
        }

        return out;
    }

    function getOriginalLineBaseline(doc, lineIndex, layer) {
        var b = null;

        try {
            b = doc.baselineLocs;
        } catch (e) {}

        var k = lineIndex * 4;

        if (
            b &&
            b.length >= k + 4 &&
            Math.abs(b[k]) < 1e30 &&
            Math.abs(b[k + 1]) < 1e30
        ) {
            return {
                start: [b[k], b[k + 1]],
                end: [b[k + 2], b[k + 3]]
            };
        }

        var r = layer.sourceRectAtTime(layer.containingComp.time, false);

        return {
            start: [r.left, r.top + r.height],
            end: [r.left + r.width, r.top + r.height]
        };
    }

    function findLineForIndex(lineRanges, index) {
        for (var i = 0; i < lineRanges.length; i++) {
            if (index >= lineRanges[i].start && index < lineRanges[i].end) {
                return lineRanges[i];
            }
        }

        if (
            lineRanges.length &&
            index === lineRanges[lineRanges.length - 1].end
        ) {
            return lineRanges[lineRanges.length - 1];
        }

        return null;
    }

    function splitRangeAcrossLines(range, lineRanges) {
        var out = [];

        for (var i = 0; i < lineRanges.length; i++) {
            var s = Math.max(range.start, lineRanges[i].start);
            var e = Math.min(range.end, lineRanges[i].end);

            if (e > s) {
                out.push({
                    start: s,
                    end: e,
                    lineIndex: lineRanges[i].lineIndex,
                    lineStart: lineRanges[i].start,
                    lineEnd: lineRanges[i].end
                });
            }
        }

        return out;
    }

    function makeCharacterSegments(text, lines) {
        var out = [];
        var i = 0;

        while (i < text.length) {
            var e = nextUnicodeCharEnd(text, i);
            var chunk = text.substring(i, e);

            if (!isWhitespaceOnly(chunk)) {
                var line = findLineForIndex(lines, i);

                if (line) {
                    out.push({
                        start: i,
                        end: e,
                        lineIndex: line.lineIndex,
                        lineStart: line.start,
                        lineEnd: line.end
                    });
                }
            }

            i = e;
        }

        return out;
    }

    function makeWordSegments(text, lines) {
        var out = [];
        var re = /\S+/g;
        var m;

        while ((m = re.exec(text)) !== null) {
            var pieces = splitRangeAcrossLines(
                {start: m.index, end: m.index + m[0].length},
                lines
            );

            for (var i = 0; i < pieces.length; i++) out.push(pieces[i]);

            if (m[0].length === 0) re.lastIndex++;
        }

        return out;
    }

    function makeLineSegments(lines) {
        var out = [];

        for (var i = 0; i < lines.length; i++) {
            if (lines[i].end > lines[i].start) {
                out.push({
                    start: lines[i].start,
                    end: lines[i].end,
                    lineIndex: lines[i].lineIndex,
                    lineStart: lines[i].start,
                    lineEnd: lines[i].end
                });
            }
        }

        return out;
    }

    function pushCustomChunks(out, text, fromIndex, matchStart, matchEnd) {
        if (
            matchStart > fromIndex &&
            !isWhitespaceOnly(text.substring(fromIndex, matchStart))
        ) {
            out.push({start: fromIndex, end: matchStart});
        }

        if (
            matchEnd > matchStart &&
            !isWhitespaceOnly(text.substring(matchStart, matchEnd))
        ) {
            out.push({start: matchStart, end: matchEnd});
        }
    }

    function makeCustomWordRanges(text, word) {
        var out = [];
        var cursor = 0;
        var at;

        if (!word) return out;

        while ((at = text.indexOf(word, cursor)) !== -1) {
            pushCustomChunks(out, text, cursor, at, at + word.length);
            cursor = at + word.length;
        }

        if (
            cursor < text.length &&
            !isWhitespaceOnly(text.substring(cursor))
        ) {
            out.push({start: cursor, end: text.length});
        }

        return out;
    }

    function parseRegexInput(input) {
        if (!input) throw new Error("Informe uma expressão regular.");

        var pattern = input;
        var flags = "g";
        var lastSlash;

        if (input.charAt(0) === "/") {
            lastSlash = input.lastIndexOf("/");

            if (lastSlash > 0) {
                pattern = input.substring(1, lastSlash);
                flags = input.substring(lastSlash + 1);

                if (flags.indexOf("g") === -1) flags += "g";
            }
        }

        flags = flags.replace(/[^gim]/g, "");
        if (flags.indexOf("g") === -1) flags += "g";

        return new RegExp(pattern, flags);
    }

    function makeRegexRanges(text, input) {
        var re = parseRegexInput(input);
        var out = [];
        var cursor = 0;
        var m;

        while ((m = re.exec(text)) !== null) {
            var start = m.index;
            var end = m.index + m[0].length;

            pushCustomChunks(out, text, cursor, start, end);
            cursor = end;

            if (m[0].length === 0) {
                re.lastIndex++;
                cursor = Math.max(cursor, re.lastIndex);
            }
        }

        if (
            cursor < text.length &&
            !isWhitespaceOnly(text.substring(cursor))
        ) {
            out.push({start: cursor, end: text.length});
        }

        return out;
    }

    function normalizeCustomRangesToLines(ranges, lines) {
        var out = [];

        for (var i = 0; i < ranges.length; i++) {
            var pieces = splitRangeAcrossLines(ranges[i], lines);

            for (var j = 0; j < pieces.length; j++) {
                out.push(pieces[j]);
            }
        }

        return out;
    }

    function buildExplodeSegments(doc, mode, customValue) {
        var text = doc.text;
        var lines = getLineRanges(doc);

        if (mode === "characters") return makeCharacterSegments(text, lines);
        if (mode === "words") return makeWordSegments(text, lines);
        if (mode === "lines") return makeLineSegments(lines);

        if (mode === "custom word") {
            return normalizeCustomRangesToLines(
                makeCustomWordRanges(text, customValue),
                lines
            );
        }

        if (mode === "custom regular expression") {
            return normalizeCustomRangesToLines(
                makeRegexRanges(text, customValue),
                lines
            );
        }

        return [];
    }

    function measurePrefixAdvance(helper, sourceLayer, t, lineStart, segmentStart) {
        if (segmentStart <= lineStart) return [0, 0];

        var prefixDoc = cloneRangeDoc(sourceLayer, t, lineStart, segmentStart);
        setStaticSourceText(helper, prefixDoc);

        var b = getBaselineStartAndEnd(helper);

        return [
            b.end[0] - b.start[0],
            b.end[1] - b.start[1]
        ];
    }

    function offsetArrayProperty(prop, delta) {
        try {
            var i, v, nv;

            if (prop.numKeys > 0) {
                for (i = 1; i <= prop.numKeys; i++) {
                    v = prop.keyValue(i);

                    if (v instanceof Array) {
                        nv = v.slice(0);
                        if (nv.length > 0) nv[0] += delta[0];
                        if (nv.length > 1) nv[1] += delta[1];
                        if (nv.length > 2 && delta.length > 2) nv[2] += delta[2];
                        prop.setValueAtKey(i, nv);
                    }
                }
            } else {
                v = prop.value;

                if (v instanceof Array) {
                    nv = v.slice(0);
                    if (nv.length > 0) nv[0] += delta[0];
                    if (nv.length > 1) nv[1] += delta[1];
                    if (nv.length > 2 && delta.length > 2) nv[2] += delta[2];
                    prop.setValue(nv);
                }
            }
        } catch (e) {}
    }

    function shiftAnchorByLocalDelta(layer, visualDelta) {
        var anchor = layer
            .property("ADBE Transform Group")
            .property("ADBE Anchor Point");

        offsetArrayProperty(
            anchor,
            [-visualDelta[0], -visualDelta[1], 0]
        );
    }

    function cleanPieceName(pieceText) {
        var s = pieceText
            .replace(/[\r\n\t]+/g, " ")
            .replace(/^\s+|\s+$/g, "");

        if (s.length > 28) s = s.substring(0, 25) + "...";

        return s || "Text";
    }

    function createExplodedPiece(sourceLayer, helper, originalDoc, segment, t) {
        var lineBaseline = getOriginalLineBaseline(
            originalDoc,
            segment.lineIndex,
            sourceLayer
        );

        var prefixAdvance = measurePrefixAdvance(
            helper,
            sourceLayer,
            t,
            segment.lineStart,
            segment.start
        );

        var desiredBaseline = [
            lineBaseline.start[0] + prefixAdvance[0],
            lineBaseline.start[1] + prefixAdvance[1]
        ];

        var pieceDoc = cloneRangeDoc(
            sourceLayer,
            t,
            segment.start,
            segment.end
        );

        var newLayer = sourceLayer.duplicate();
        setStaticSourceText(newLayer, pieceDoc);

        var natural = getBaselineStartAndEnd(newLayer).start;

        shiftAnchorByLocalDelta(
            newLayer,
            [
                desiredBaseline[0] - natural[0],
                desiredBaseline[1] - natural[1]
            ]
        );

        try {
            newLayer.name = cleanPieceName(pieceDoc.text);
        } catch (e) {}

        return newLayer;
    }

    function reorderExplodedLayers(created, sourceLayer, layerOrder, rtlText) {
        var ordered = created.slice(0);
        var i;

        if (rtlText) ordered.reverse();

        if (layerOrder === "topToBottom") {
            var anchorTop = sourceLayer;

            for (i = ordered.length - 1; i >= 0; i--) {
                try {
                    ordered[i].moveBefore(anchorTop);
                    anchorTop = ordered[i];
                } catch (e1) {}
            }
        } else {
            var anchorBottom = sourceLayer;

            for (i = 0; i < ordered.length; i++) {
                try {
                    ordered[i].moveBefore(anchorBottom);
                    anchorBottom = ordered[i];
                } catch (e2) {}
            }
        }
    }

    function isUnsupportedText(doc) {
        try {
            if (
                typeof LineOrientation !== "undefined" &&
                doc.lineOrientation !== LineOrientation.HORIZONTAL
            ) {
                return "texto vertical não é suportado.";
            }
        } catch (e1) {}

        try {
            var j = doc.justification;
            var PJ = ParagraphJustification;
            if (
                j === PJ.FULL_JUSTIFY_LASTLINE_LEFT ||
                j === PJ.FULL_JUSTIFY_LASTLINE_RIGHT ||
                j === PJ.FULL_JUSTIFY_LASTLINE_CENTER ||
                j === PJ.FULL_JUSTIFY_LASTLINE_FULL ||
                j === PJ.MULTIPLE_JUSTIFICATIONS
            ) {
                return "texto justificado não é suportado.";
            }
        } catch (e2) {}

        return null;
    }

    function explodeSelectedText(opts) {
        var comp = app.project ? app.project.activeItem : null;

        if (!isComp(comp)) {
            alert("Abra uma composição e selecione uma ou mais camadas de texto.");
            return {pieces: 0, skipped: 0, failed: 0, keptOriginals: 0};
        }

        var selected = comp.selectedLayers;
        var textLayers = [];

        for (var i = 0; i < selected.length; i++) {
            if (isTextLayer(selected[i])) textLayers.push(selected[i]);
        }

        if (textLayers.length === 0) {
            alert("Nenhuma camada de texto selecionada.");
            return {pieces: 0, skipped: selected.length, failed: 0, keptOriginals: 0};
        }

        var totalPieces = 0;
        var skipped = 0;
        var failedPieces = 0;
        var keptOriginals = 0;
        var allCreated = [];

        app.beginUndoGroup("Explode Mesmo");

        try {
            for (i = 0; i < textLayers.length; i++) {
                var layer = textLayers[i];
                var doc = getTextDocAtTime(layer, comp.time);
                var segments;
                var unsupported = isUnsupportedText(doc);

                if (unsupported) {
                    skipped++;
                    alert("'" + layer.name + "' foi ignorada: " + unsupported);
                    continue;
                }

                try {
                    segments = buildExplodeSegments(
                        doc,
                        opts.split,
                        opts.splitWord
                    );
                } catch (segErr) {
                    skipped++;
                    alert(
                        "Erro em '" + layer.name + "':\n" +
                        segErr.toString().replace("Error: ", "")
                    );
                    continue;
                }

                if (!segments || segments.length === 0) {
                    skipped++;
                    continue;
                }

                var helper = layer.duplicate();
                var created = [];

                try {
                    try {
                        helper.name = "__EXPLODE_MESMO_MEASURE__";
                        helper.shy = true;
                    } catch (e0) {}

                    for (var j = 0; j < segments.length; j++) {
                        try {
                            created.push(
                                createExplodedPiece(
                                    layer,
                                    helper,
                                    doc,
                                    segments[j],
                                    comp.time
                                )
                            );
                        } catch (pieceErr) {
                            failedPieces++;
                        }
                    }
                } finally {
                    // A layer auxiliar nunca pode sobrar na comp.
                    try { helper.remove(); } catch (e1) {}
                }

                if (created.length === 0) {
                    // Nada foi criado: preserva a original mesmo com "Excluir" ativo.
                    skipped++;
                    continue;
                }

                reorderExplodedLayers(
                    created,
                    layer,
                    opts.layerOrder,
                    opts.rtlText
                );

                totalPieces += created.length;
                for (var k = 0; k < created.length; k++) allCreated.push(created[k]);

                if (opts.deleteOriginal && created.length === segments.length) {
                    try {
                        layer.remove();
                    } catch (e2) {}
                } else if (opts.deleteOriginal) {
                    keptOriginals++;
                }
            }

            // Deixa selecionadas só as peças novas, prontas para animar.
            try {
                for (i = 0; i < textLayers.length; i++) {
                    try { textLayers[i].selected = false; } catch (eSel) {}
                }
                for (i = 0; i < allCreated.length; i++) allCreated[i].selected = true;
            } catch (eSel2) {}

        } finally {
            app.endUndoGroup();
        }

        return {
            pieces: totalPieces,
            skipped: skipped,
            failed: failedPieces,
            keptOriginals: keptOriginals
        };
    }

    function buildExplodeTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = [0, 6, 0, 0];

        var splitPanel = uiSection(tab, "Dividir");
        splitPanel.orientation = "column";
        splitPanel.alignChildren = ["fill", "top"];

        var rowMode = splitPanel.add("group");
        rowMode.orientation = "row";

        uiLabel(rowMode, "Dividir em:");

        var ddMode = rowMode.add(
            "dropdownlist",
            undefined,
            [
                "Letras",
                "Palavras",
                "Linhas",
                "Palavra específica",
                "Expressão regular (regex)"
            ]
        );
        ddMode.selection = 0;
        ddMode.alignment = ["fill", "center"];

        var customGroup = splitPanel.add("group");
        customGroup.orientation = "row";

        var customLabel = customGroup.add("statictext", undefined, "Valor:");

        var txtCustom = customGroup.add("edittext", undefined, "");
        uiFlex(txtCustom);
        txtCustom.alignment = ["fill", "center"];

        var optionsPanel = uiSection(tab, "Opções");
        optionsPanel.orientation = "column";
        optionsPanel.alignChildren = ["left", "top"];

        var cbDelete = optionsPanel.add(
            "checkbox",
            undefined,
            "Excluir camada original"
        );

        var cbRTL = optionsPanel.add(
            "checkbox",
            undefined,
            "Texto RTL (direita para esquerda)"
        );

        var orderRow = optionsPanel.add("group");
        orderRow.orientation = "row";
        uiLabel(orderRow, "Ordem das layers:");

        var ddOrder = orderRow.add(
            "dropdownlist",
            undefined,
            ["De cima para baixo", "De baixo para cima"]
        );
        ddOrder.selection = 0;

        var btnApply = uiButton(tab, "EXPLODIR TEXTO", {primary: true});

        var status = addStatus(tab, "Selecione uma ou mais camadas de texto.");

        function refreshCustomState() {
            var idx = ddMode.selection ? ddMode.selection.index : 0;

            customGroup.enabled = idx >= 3;

            if (idx === 3) customLabel.text = "Palavra:";
            else if (idx === 4) customLabel.text = "Regex:";
            else customLabel.text = "Valor:";
        }

        function modeFromIndex(idx) {
            if (idx === 1) return "words";
            if (idx === 2) return "lines";
            if (idx === 3) return "custom word";
            if (idx === 4) return "custom regular expression";
            return "characters";
        }

        ddMode.onChange = refreshCustomState;
        refreshCustomState();

        btnApply.onClick = function () {
            var mode = modeFromIndex(
                ddMode.selection ? ddMode.selection.index : 0
            );

            if (
                (mode === "custom word" ||
                 mode === "custom regular expression") &&
                txtCustom.text === ""
            ) {
                alert(
                    mode === "custom word"
                        ? "Digite a palavra que deseja isolar."
                        : "Digite uma expressão regular."
                );
                return;
            }

            var result = explodeSelectedText({
                split: mode,
                splitWord: txtCustom.text,
                rtlText: cbRTL.value,
                deleteOriginal: cbDelete.value,
                layerOrder:
                    ddOrder.selection && ddOrder.selection.index === 1
                        ? "bottomToTop"
                        : "topToBottom"
            });

            status.text =
                result.pieces + " layer(s) criada(s)" +
                (result.skipped ? " | " + result.skipped + " ignorada(s)" : "") +
                (result.failed ? " | " + result.failed + " peça(s) falharam" : "") +
                ".";

            if (result.keptOriginals) {
                alert(
                    "Algumas peças não puderam ser criadas, então " +
                    result.keptOriginals +
                    " camada(s) original(is) foram mantidas para você não perder o texto."
                );
            }
        };
    }

    function build3DTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = [0, 6, 0, 0];

        var info = uiFlex(uiLabel(tab, "Comps selecionadas no Project (ou a comp aberta)."));
        info.helpTip = "Se nada estiver selecionado no Project, age na comp que está aberta.";

        var optionsPanel = uiSection(tab, "Opções");
        optionsPanel.orientation = "column";
        optionsPanel.alignChildren = ["left", "top"];

        var recursiveCheckbox = optionsPanel.add("checkbox", undefined, "Processar precomps");
        recursiveCheckbox.value = loadSetting("layersRecursive", "1") === "1";

        var lockedCheckbox = optionsPanel.add("checkbox", undefined, "Processar camadas bloqueadas");
        lockedCheckbox.value = loadSetting("layersLocked", "1") === "1";

        // ----- 3D -----
        var sec3D = uiSection(tab, "Camadas 3D");

        var btns = sec3D.add("group");
        btns.orientation = "row";
        btns.alignChildren = ["fill", "center"];

        var make3DButton = uiButton(btns, "ATIVAR 3D", {primary: true});
        var disable3DButton = uiButton(btns, "DESATIVAR 3D", {height: 32});

        // ----- Motion Blur -----
        var secMB = uiSection(tab, "Motion Blur");

        var compMBCheckbox = secMB.add(
            "checkbox",
            undefined,
            "Ligar a chave de Motion Blur da comp"
        );
        uiFlex(compMBCheckbox);
        compMBCheckbox.value = loadSetting("mbCompSwitch", "1") === "1";
        compMBCheckbox.helpTip =
            "Sem a chave da comp ligada, o blur das camadas não aparece no preview nem no render.";

        var mbBtns = secMB.add("group");
        mbBtns.orientation = "row";
        mbBtns.alignChildren = ["fill", "center"];

        var mbOnButton = uiButton(mbBtns, "LIGAR MOTION BLUR", {primary: true});
        var mbOffButton = uiButton(mbBtns, "DESLIGAR MOTION BLUR", {height: 32});

        var status = addStatus(tab, "Selecione comps no Project.");

        // Câmeras, luzes e camadas só de áudio não têm switch 3D.
        function canBe3D(layer) {
            if (layer instanceof CameraLayer || layer instanceof LightLayer) return false;
            try {
                if (layer.hasVideo === false) return false;
            } catch (eV) {}
            return true;
        }

        // Motion Blur: tudo que aparece na imagem (null não renderiza).
        function canBlur(layer) {
            if (!canBe3D(layer)) return false;
            try {
                if (layer.nullLayer) return false;
            } catch (eN) {}
            return true;
        }

        var MODES = {
            threeD: {
                label: "3D",
                canApply: canBe3D,
                get: function (layer) { return layer.threeDLayer; },
                set: function (layer, v) { layer.threeDLayer = v; }
            },
            motionBlur: {
                label: "Motion Blur",
                canApply: canBlur,
                get: function (layer) { return layer.motionBlur; },
                set: function (layer, v) { layer.motionBlur = v; },
                onComp: function (comp, v) {
                    if (!compMBCheckbox.value) return false;
                    if (comp.motionBlur === v) return false;
                    comp.motionBlur = v;
                    return true;
                }
            }
        };

        function targetComps() {
            var out = getSelectedComps();

            if (out.length === 0 && app.project && isComp(app.project.activeItem)) {
                out.push(app.project.activeItem);
            }

            return out;
        }

        function processSelection(mode, enable) {
            if (!app.project) {
                alert("Nenhum projeto aberto.");
                return;
            }

            var comps = targetComps();

            if (comps.length === 0) {
                alert("Selecione pelo menos uma composição no Project (ou abra uma comp).");
                return;
            }

            var recursive = recursiveCheckbox.value;
            var processLocked = lockedCheckbox.value;
            var processed = {};
            var compCount = 0;
            var compSwitches = 0;
            var layerCount = 0;

            saveSetting("layersRecursive", recursive ? "1" : "0");
            saveSetting("layersLocked", processLocked ? "1" : "0");
            saveSetting("mbCompSwitch", compMBCheckbox.value ? "1" : "0");

            function processComp(comp) {
                if (!(comp instanceof CompItem)) return;

                var key = "c" + comp.id;
                if (processed[key]) return;

                processed[key] = true;
                compCount++;

                if (mode.onComp) {
                    try { if (mode.onComp(comp, enable)) compSwitches++; } catch (eC) {}
                }

                for (var i = 1; i <= comp.numLayers; i++) {
                    var layer = comp.layer(i);

                    try {
                        if (mode.canApply(layer) && mode.get(layer) !== enable) {
                            var wasLocked = layer.locked;

                            if (wasLocked && processLocked) layer.locked = false;

                            if (!layer.locked) {
                                try {
                                    mode.set(layer, enable);
                                    layerCount++;
                                } catch (e0) {}
                            }

                            if (wasLocked && processLocked) layer.locked = true;
                        }
                    } catch (e1) {}

                    if (recursive) {
                        try {
                            if (layer.source instanceof CompItem) processComp(layer.source);
                        } catch (e2) {}
                    }
                }
            }

            app.beginUndoGroup((enable ? "Ligar " : "Desligar ") + mode.label);

            try {
                for (var i = 0; i < comps.length; i++) processComp(comps[i]);
            } finally {
                app.endUndoGroup();
            }

            status.text =
                mode.label + (enable ? " ligado" : " desligado") + ": " +
                layerCount + " camada(s) em " + compCount + " comp(s)" +
                (compSwitches ? " | chave da comp " + (enable ? "ligada" : "desligada") + " em " + compSwitches : "") +
                ".";
        }

        make3DButton.onClick = function () { processSelection(MODES.threeD, true); };
        disable3DButton.onClick = function () { processSelection(MODES.threeD, false); };
        mbOnButton.onClick = function () { processSelection(MODES.motionBlur, true); };
        mbOffButton.onClick = function () { processSelection(MODES.motionBlur, false); };
    }

    function getExpressionStoreFile() {
        var dir = new Folder(Folder.userData.fsName + "/MesmoTools");

        if (!dir.exists) {
            try {
                dir.create();
            } catch (e) {}
        }

        return new File(dir.fsName + "/expression_favorites.txt");
    }

    function loadExpressionFavorites() {
        var out = [];
        var f = getExpressionStoreFile();

        if (!f.exists) return out;

        try {
            f.encoding = "UTF-8";

            if (!f.open("r")) return out;

            while (!f.eof) {
                var line = f.readln();

                if (line === "") continue;

                var tabIndex = line.indexOf("\t");
                if (tabIndex === -1) continue;

                var nameEnc = line.substring(0, tabIndex);
                var codeEnc = line.substring(tabIndex + 1);

                try {
                    out.push({
                        name: decodeURIComponent(nameEnc),
                        code: decodeURIComponent(codeEnc)
                    });
                } catch (decodeErr) {}
            }

            f.close();
        } catch (e) {
            try { f.close(); } catch (closeErr) {}
        }

        return out;
    }

    function saveExpressionFavorites(favorites) {
        var f = getExpressionStoreFile();

        try {
            f.encoding = "UTF-8";

            if (!f.open("w")) {
                throw new Error("Não foi possível abrir o arquivo de favoritos.");
            }

            for (var i = 0; i < favorites.length; i++) {
                f.writeln(
                    encodeURIComponent(favorites[i].name) +
                    "\t" +
                    encodeURIComponent(favorites[i].code)
                );
            }

            f.close();
            return true;

        } catch (e) {
            try { f.close(); } catch (closeErr) {}
            alert(
                "Não foi possível salvar os favoritos:\n" +
                e.toString().replace("Error: ", "") + WRITE_HELP
            );
            return false;
        }
    }

    function findFavoriteIndex(favorites, name) {
        for (var i = 0; i < favorites.length; i++) {
            if (favorites[i].name === name) return i;
        }

        return -1;
    }

    function collectSelectedExpressionProperties() {
        var out = [];
        var comp = app.project ? app.project.activeItem : null;

        if (!isComp(comp)) return out;

        function addProp(p) {
            if (!p) return;

            var canSet = false;

            try {
                canSet = p.canSetExpression === true;
            } catch (e0) {}

            if (!canSet) return;

            for (var k = 0; k < out.length; k++) {
                if (out[k] === p) return;
            }

            out.push(p);
        }

        try {
            var compProps = comp.selectedProperties;

            if (compProps && compProps.length) {
                for (var i = 0; i < compProps.length; i++) {
                    addProp(compProps[i]);
                }
            }
        } catch (e1) {}

        try {
            var layers = comp.selectedLayers;

            for (var j = 0; j < layers.length; j++) {
                var props = layers[j].selectedProperties;

                if (!props) continue;

                for (var p = 0; p < props.length; p++) {
                    addProp(props[p]);
                }
            }
        } catch (e2) {}

        return out;
    }

    // ================================================================
    // BIBLIOTECA DE EXPRESSÕES DO MESMO
    // Gerada a partir de github.com/francismsmo/After-effects-Expressions.
    // Cada atalho traz descrição, onde aplicar e um tutorial em comentário.
    // ================================================================

    var EXPRESSION_LIBRARY = [
        {
            name: "Delay do Control — Position",
            cat: "Delay",
            target: "Position",
            desc: "A camada segue a Position do pai (parent) com alguns frames de atraso. Use valores de delay diferentes em cada camada para um efeito em cascata.",
            needs: [],
            code: [
                "/* ============================================================",
                "   DELAY DO CONTROL — POSITION",
                "   Aplicar em: Position da camada que vai seguir o Control",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   A camada repete o movimento da camada pai (parent), só que alguns",
                "   frames atrasada. Dá aquele efeito de \"arrasto\" / follow-through",
                "   em cascata.",
                "",
                "   Como usar:",
                "   1. Crie uma camada de controle (ex.: um Null chamado \"Control\")",
                "      e anime a Position dela.",
                "   2. Faça o parent das camadas que vão seguir para o Control",
                "      (pick whip do Parent & Link).",
                "   3. Cole esta expressão na Position de cada camada filha.",
                "   4. Ajuste delayFrames abaixo. Use valores diferentes em cada",
                "      camada (3, 6, 9...) para o efeito de cascata.",
                "",
                "   Observações:",
                "   - Sem parent, a camada fica parada no próprio valor.",
                "   - Funciona melhor com o Control sem rotação e com escala 100%,",
                "     porque o atraso é somado no espaço do pai.",
                "   ============================================================ */",
                "",
                "var delayFrames = 3; // Ajuste aqui quantos frames de atraso você quer",
                "var delayTime = framesToTime(delayFrames);",
                "",
                "// Definimos o alvo (o seu objeto Control)",
                "var target = parent;",
                "",
                "if (target != null) {",
                "    // Calculamos onde o Control estava há 'X' frames atrás",
                "    var delayedPos = target.transform.position.valueAtTime(time - delayTime);",
                "",
                "    // Calculamos onde o Control está AGORA",
                "    var currentPos = target.transform.position.valueAtTime(time);",
                "",
                "    // Diferença de movimento (Delta)",
                "    var delta = delayedPos - currentPos;",
                "",
                "    // Aplica o movimento ao valor original da camada (mantendo o layout)",
                "    value + delta;",
                "} else {",
                "    value;",
                "}"
            ].join("\n")
        },
        {
            name: "Delay do Control — Rotation",
            cat: "Delay",
            target: "Rotation",
            desc: "A camada repete a rotação do pai (parent) com alguns frames de atraso.",
            needs: [],
            code: [
                "/* ============================================================",
                "   DELAY DO CONTROL — ROTATION",
                "   Aplicar em: Rotation da camada que vai seguir o Control",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   A camada repete a rotação da camada pai (parent), só que alguns",
                "   frames atrasada. Dá aquele efeito de \"arrasto\" / follow-through",
                "   em cascata.",
                "",
                "   Como usar:",
                "   1. Crie uma camada de controle (ex.: um Null chamado \"Control\")",
                "      e anime a Rotation dela.",
                "   2. Faça o parent das camadas que vão seguir para o Control",
                "      (pick whip do Parent & Link).",
                "   3. Cole esta expressão na Rotation de cada camada filha.",
                "   4. Ajuste delayFrames abaixo. Use valores diferentes em cada",
                "      camada (3, 6, 9...) para o efeito de cascata.",
                "",
                "   Observações:",
                "   - Sem parent, a camada fica parada no próprio valor.",
                "   - Em camadas 3D, aplique na Z Rotation.",
                "   ============================================================ */",
                "",
                "var delayFrames = 3; // Quantos frames de atraso",
                "var delayTime = framesToTime(delayFrames);",
                "var target = parent;",
                "",
                "if (target != null) {",
                "    // Calcula a diferença de rotação do pai",
                "    var rotaPaiAtrasada = target.transform.rotation.valueAtTime(time - delayTime);",
                "    var rotaPaiAgora = target.transform.rotation.valueAtTime(time);",
                "    var delta = rotaPaiAtrasada - rotaPaiAgora;",
                "",
                "    // Rotação própria da camada + o atraso do pai",
                "    value + delta;",
                "} else {",
                "    value;",
                "}"
            ].join("\n")
        },
        {
            name: "Delay do Control — Scale",
            cat: "Delay",
            target: "Scale",
            desc: "A camada repete a escala do pai (parent) com alguns frames de atraso. Ótimo para pops em cascata.",
            needs: [],
            code: [
                "/* ============================================================",
                "   DELAY DO CONTROL — SCALE",
                "   Aplicar em: Scale da camada que vai seguir o Control",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   A camada repete a escala da camada pai (parent), só que alguns",
                "   frames atrasada. Dá aquele efeito de \"arrasto\" / follow-through",
                "   em cascata.",
                "",
                "   Como usar:",
                "   1. Crie uma camada de controle (ex.: um Null chamado \"Control\")",
                "      e anime a Scale dela.",
                "   2. Faça o parent das camadas que vão seguir para o Control",
                "      (pick whip do Parent & Link).",
                "   3. Cole esta expressão na Scale de cada camada filha.",
                "   4. Ajuste delayFrames abaixo. Use valores diferentes em cada",
                "      camada (3, 6, 9...) para o efeito de cascata.",
                "",
                "   Observações:",
                "   - Sem parent, a camada fica parada no próprio valor.",
                "   - Funciona melhor com escala uniforme no Control (X = Y)",
                "     e em animações rápidas, tipo pops.",
                "   ============================================================ */",
                "",
                "var delayFrames = 3; // Quantos frames de atraso",
                "var delayTime = framesToTime(delayFrames);",
                "var target = parent;",
                "",
                "if (target != null) {",
                "    // Calcula a diferença de escala do pai",
                "    var escalaPaiAtrasada = target.transform.scale.valueAtTime(time - delayTime);",
                "    var escalaPaiAgora = target.transform.scale.valueAtTime(time);",
                "    var delta = escalaPaiAtrasada - escalaPaiAgora;",
                "",
                "    // Escala própria da camada + o atraso do pai",
                "    value + delta;",
                "} else {",
                "    value;",
                "}"
            ].join("\n")
        },
        {
            name: "Wiggle crescente",
            cat: "Wiggle",
            target: "Scale",
            desc: "Wiggle que começa parado e vai ficando mais forte com o tempo, sem limite. Mantém a proporção da escala.",
            needs: [],
            code: [
                "/* ============================================================",
                "   WIGGLE CRESCENTE (sem limite)",
                "   Aplicar em: Scale",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   A intensidade do wiggle começa em 0 e aumenta growthRate a",
                "   cada segundo. Usa o mesmo valor em X e Y, então a camada",
                "   pulsa sem distorcer.",
                "",
                "   Como usar:",
                "   1. Cole na Scale da camada.",
                "   2. growthRate = quanto a intensidade cresce por segundo.",
                "   3. O 0.5 dentro do wiggle é a frequência (tremidas por segundo).",
                "",
                "   Observações:",
                "   - Conta a partir do início da comp (time = 0). Se a camada",
                "     começa depois, troque time por (time - inPoint).",
                "   - Quer um teto? Use o atalho \"Wiggle crescente com limite\".",
                "   ============================================================ */",
                "",
                "// Rate defines how much the wiggle intensity increases per second",
                "var growthRate = 10;",
                "var dynamicAmount = time * growthRate;",
                "",
                "// Wiggle(frequency, amplitude)",
                "var w = wiggle(0.5, dynamicAmount);",
                "",
                "// Mesmo valor em X e Y = mantém a proporção",
                "[w[0], w[0]]"
            ].join("\n")
        },
        {
            name: "Wiggle crescente com limite",
            cat: "Wiggle",
            target: "Scale",
            desc: "Igual ao wiggle crescente, mas para de crescer quando chega no limite.",
            needs: [],
            code: [
                "/* ============================================================",
                "   WIGGLE CRESCENTE COM LIMITE",
                "   Aplicar em: Scale",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   A intensidade do wiggle cresce growthRate por segundo até",
                "   chegar em limit, e daí em diante fica constante. Mantém a",
                "   proporção da escala.",
                "",
                "   Como usar:",
                "   1. Cole na Scale da camada.",
                "   2. growthRate = quanto cresce por segundo.",
                "   3. limit = intensidade máxima.",
                "      Ex.: growthRate 10 e limit 30 -> chega no máximo em 3 s.",
                "",
                "   Observação: conta a partir do início da comp. Se a camada",
                "   começa depois, troque time por (time - inPoint).",
                "   ============================================================ */",
                "",
                "var growthRate = 10; // Increases by 10 every second",
                "var limit = 30;      // Intensidade máxima",
                "",
                "// This will grow until it hits 30, then stay there",
                "var dynamicAmount = Math.min(time * growthRate, limit);",
                "",
                "var w = wiggle(0.5, dynamicAmount);",
                "",
                "// Mesmo valor em X e Y = mantém a proporção",
                "[w[0], w[0]]"
            ].join("\n")
        },
        {
            name: "Wiggle diminuindo",
            cat: "Wiggle",
            target: "Rotation",
            desc: "Wiggle que começa forte e vai acalmando até parar. Bom para algo que balança e se estabiliza.",
            needs: [],
            code: [
                "/* ============================================================",
                "   WIGGLE DIMINUINDO (amortecido)",
                "   Aplicar em: Rotation (funciona em qualquer propriedade)",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Começa com intensidade startAmount e perde decayRate por",
                "   segundo até chegar em 0, quando a camada para de tremer.",
                "",
                "   Como usar:",
                "   1. Cole na Rotation da camada.",
                "   2. startAmount = intensidade inicial (graus, na Rotation).",
                "   3. decayRate = quanto perde por segundo.",
                "      Ex.: 30 e 10 -> para totalmente em 3 s.",
                "",
                "   Observações:",
                "   - Em Position e Scale também funciona; o wiggle devolve o",
                "     valor completo da propriedade.",
                "   - Conta a partir do início da comp. Se a camada começa",
                "     depois, troque time por (time - inPoint).",
                "   ============================================================ */",
                "",
                "var startAmount = 30; // Intensidade inicial",
                "var decayRate = 10;   // Quanto diminui por segundo",
                "",
                "// Nunca fica negativo: para em 0",
                "var dynamicAmount = Math.max(startAmount - (time * decayRate), 0);",
                "",
                "// Em Rotation, o wiggle já retorna o valor final direto",
                "wiggle(0.5, dynamicAmount);"
            ].join("\n")
        },
        {
            name: "Wiggle em loop",
            cat: "Wiggle",
            target: "Qualquer propriedade",
            desc: "Wiggle que se repete perfeitamente a cada X segundos, sem pulo no ponto do loop. Ideal para vídeos em loop e GIFs.",
            needs: [],
            code: [
                "/* ============================================================",
                "   WIGGLE EM LOOP PERFEITO",
                "   Aplicar em: qualquer propriedade (Position, Rotation, Scale...)",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Mistura dois wiggles iguais deslocados de loopTime. O final",
                "   do ciclo encaixa exatamente no começo, então dá para repetir",
                "   sem \"pulo\".",
                "",
                "   Como usar:",
                "   1. Cole na propriedade.",
                "   2. freq = quantas vezes por segundo se mexe.",
                "   3. amp = tamanho do movimento (px, graus ou %).",
                "   4. loopTime = duração do loop em segundos. Use a duração",
                "      da comp (ou uma fração dela) para o loop fechar certinho.",
                "   ============================================================ */",
                "",
                "// --- CONFIGURAÇÕES ---",
                "freq = 2;       // Frequência (quantas vezes se move por segundo)",
                "amp = 50;       // Amplitude (distância/tamanho da variação)",
                "loopTime = 10;  // Duração do loop em segundos",
                "",
                "// --- CÁLCULO DO LOOP ---",
                "t = time % loopTime;",
                "w1 = wiggle(freq, amp, 1, 0.5, t);",
                "w2 = wiggle(freq, amp, 1, 0.5, t - loopTime);",
                "",
                "// Interpolação entre o primeiro e o segundo wiggle",
                "linear(t, 0, loopTime, w1, w2);"
            ].join("\n")
        },
        {
            name: "Wiggle na escala proporcional",
            cat: "Wiggle",
            target: "Scale",
            desc: "Wiggle na Scale sem distorcer: largura e altura variam juntas.",
            needs: [],
            code: [
                "/* ============================================================",
                "   WIGGLE NA ESCALA MANTENDO A PROPORÇÃO",
                "   Aplicar em: Scale",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Um wiggle normal na Scale sorteia X e Y separados e a camada",
                "   \"estica\". Aqui o X é usado nos dois eixos, então ela só cresce",
                "   e encolhe por igual.",
                "",
                "   Como usar:",
                "   1. Cole na Scale.",
                "   2. wiggle(5, 30): 5 = frequência (vezes por segundo),",
                "      30 = intensidade (em %).",
                "   ============================================================ */",
                "",
                "//This Wiggle on Scale keep the aspect ratio the same.",
                "w = wiggle(5, 30);",
                "",
                "// Mesmo valor em X e Y",
                "[w[0], w[0]]"
            ].join("\n")
        },
        {
            name: "Revelar texto letra por letra",
            cat: "Texto",
            target: "Range Selector > Start",
            desc: "Revela o texto uma letra por frame, do jeito máquina de escrever. A duração se ajusta sozinha ao tamanho do texto.",
            needs: [],
            code: [
                "/* ============================================================",
                "   REVELAR TEXTO LETRA POR LETRA",
                "   Aplicar em: Start do Range Selector de um animator de Opacity",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Anima o Start de 0 a 100 em tantos frames quantas letras o",
                "   texto tiver: 1 letra por frame. Se o texto muda, a duração",
                "   acompanha.",
                "",
                "   Como usar:",
                "   1. Na camada de texto: Animate > Opacity.",
                "   2. No animator criado, coloque Opacity = 0%.",
                "   3. Abra o Range Selector 1 e cole esta expressão no Start.",
                "   4. O texto aparece da esquerda para a direita.",
                "",
                "   Dicas:",
                "   - Mais lento: troque framesToTime(numChars) por",
                "     framesToTime(numChars * 2) (2 frames por letra).",
                "   - Começa no início da comp. Para começar quando a camada",
                "     entra, troque time por (time - inPoint).",
                "   ============================================================ */",
                "",
                "//Inserir seguinte animação - Opacity 0% e inserir esse código no Start",
                "",
                "var numChars = text.sourceText.length;  // quantas letras o texto tem",
                "var finalTime = framesToTime(numChars); // 1 frame por letra",
                "linear(time, 0, finalTime, 0, 100);"
            ].join("\n")
        },
        {
            name: "Encadear texto APOIO depois do PRINCIPAL",
            cat: "Texto",
            target: "Range Selector > Start (camada APOIO)",
            desc: "Faz a animação da camada APOIO começar sozinha assim que a camada PRINCIPAL termina de animar (Start chega em 100).",
            needs: [],
            code: [
                "/* ============================================================",
                "   ENCADEAR TEXTO: APOIO COMEÇA QUANDO O PRINCIPAL TERMINA",
                "   Aplicar em: Start do Range Selector da camada APOIO",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Fica olhando o Start do Range Selector da camada PRINCIPAL.",
                "   Quando ele chega em 100 (animação terminou), o Start da APOIO",
                "   vai de 0 a 100 em 15 frames. Se você mudar o timing do",
                "   PRINCIPAL, a APOIO acompanha sozinha.",
                "",
                "   Como usar:",
                "   1. Tenha duas camadas de texto chamadas PRINCIPAL e APOIO,",
                "      cada uma com \"Animator 1\" > \"Range Selector 1\".",
                "   2. Anime (ou use expressão) no Start da PRINCIPAL indo até 100.",
                "   3. Cole esta expressão no Start do Range Selector da APOIO.",
                "   4. Ajuste a duração em framesToTime(15).",
                "",
                "   Observações:",
                "   - Os nomes das camadas, do animator e do selector precisam",
                "     ser exatamente esses. Se renomear, troque aqui também.",
                "   - A expressão procura para trás frame a frame; em comps muito",
                "     longas pode deixar o preview um pouco mais lento.",
                "   ============================================================ */",
                "",
                "// Aplicar no Start do Range Selector da camada APOIO",
                "// A animação começa quando o Start da camada PRINCIPAL chega a 100.",
                "",
                "var anterior = thisComp",
                "    .layer(\"PRINCIPAL\")",
                "    .text",
                "    .animator(\"Animator 1\")",
                "    .selector(\"Range Selector 1\")",
                "    .start;",
                "",
                "var duracao = framesToTime(15); // duração da animação da APOIO",
                "",
                "if (anterior < 100){",
                "    0; // PRINCIPAL ainda animando: APOIO espera",
                "}else{",
                "    var inicio = time;",
                "",
                "    // Volta no tempo até achar o frame em que o PRINCIPAL chegou a 100",
                "    for (var t = time; t >= 0; t -= thisComp.frameDuration){",
                "        var v = thisComp",
                "            .layer(\"PRINCIPAL\")",
                "            .text",
                "            .animator(\"Animator 1\")",
                "            .selector(\"Range Selector 1\")",
                "            .start",
                "            .valueAtTime(t);",
                "",
                "        if (v < 100){",
                "            inicio = t + thisComp.frameDuration;",
                "            break;",
                "        }",
                "    }",
                "",
                "    // A partir dali, anima de 0 a 100",
                "    linear(time, inicio, inicio + duracao, 0, 100);",
                "}"
            ].join("\n")
        },
        {
            name: "Contador com 2 dígitos (00–99)",
            cat: "Números",
            target: "Source Text",
            desc: "Mostra o valor de um Slider como número inteiro com zero à esquerda (00, 01... 10). Para contadores e placares.",
            needs: ["Slider Control"],
            code: [
                "/* ============================================================",
                "   CONTADOR COM 2 DÍGITOS (00, 01, 02... 10, 11...)",
                "   Aplicar em: Source Text de uma camada de texto",
                "   Precisa de: efeito \"Slider Control\" na mesma camada",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Arredonda o valor do Slider e coloca um zero na frente dos",
                "   números menores que 10.",
                "",
                "   Como usar:",
                "   1. Na camada de texto, adicione Effect > Expression Controls",
                "      > Slider Control (o painel cria sozinho se faltar).",
                "   2. Cole esta expressão no Source Text.",
                "   3. Anime o Slider (ex.: de 0 a 10) e o texto conta.",
                "   ============================================================ */",
                "",
                "s = Math.round(effect(\"Slider Control\")(\"Slider\"));",
                "",
                "// Menor que 10 ganha um zero na frente",
                "if (s < 10) { \"0\" + s } else { s.toString() }"
            ].join("\n")
        },
        {
            name: "Contador com 6 dígitos (000.000)",
            cat: "Números",
            target: "Source Text",
            desc: "Mostra o valor de um Slider com 6 dígitos e ponto de milhar (000.000). Para contadores de views, valores, etc.",
            needs: ["Slider Control"],
            code: [
                "/* ============================================================",
                "   CONTADOR COM 6 DÍGITOS (000.000)",
                "   Aplicar em: Source Text de uma camada de texto",
                "   Precisa de: efeito \"Slider Control\" na mesma camada",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Arredonda o Slider, completa com zeros até 6 dígitos e põe um",
                "   ponto no meio. Ex.: 1234 -> \"001.234\".",
                "",
                "   Como usar:",
                "   1. Adicione um Slider Control na camada de texto (o painel",
                "      cria sozinho se faltar).",
                "   2. Cole esta expressão no Source Text.",
                "   3. Anime o Slider de 0 até o valor final (máx. 999999).",
                "",
                "   Observação: números negativos e acima de 999.999 não cabem",
                "   no formato.",
                "   ============================================================ */",
                "",
                "s = Math.round(effect(\"Slider Control\")(\"Slider\"));",
                "",
                "// Completa com zeros à esquerda e pega os 6 últimos dígitos",
                "txt = (\"000000\" + s).slice(-6);",
                "",
                "// Ponto separando os milhares",
                "txt.slice(0, 3) + \".\" + txt.slice(3);"
            ].join("\n")
        },
        {
            name: "Timecode de câmera (00:00:SS:FF)",
            cat: "Números",
            target: "Source Text",
            desc: "Simula o timecode de câmera a partir de um Slider que conta frames (30 fps): mostra 00:00:segundos:frames.",
            needs: ["Slider Control"],
            code: [
                "/* ============================================================",
                "   TIMECODE DE CÂMERA (00:00:SS:FF a 30 fps)",
                "   Aplicar em: Source Text de uma camada de texto",
                "   Precisa de: efeito \"Slider Control\" na mesma camada",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   O Slider é um contador de FRAMES. A expressão divide por 30 e",
                "   mostra segundos e frames no formato de timecode de câmera:",
                "   \"00:00:\" fixo + SS:FF.",
                "   (No código, \"minutos\" guarda os segundos e \"segundos\" guarda",
                "   os frames.)",
                "",
                "   Como usar:",
                "   1. Adicione um Slider Control na camada de texto (o painel",
                "      cria sozinho se faltar).",
                "   2. Cole esta expressão no Source Text.",
                "   3. Anime o Slider. Ex.: 0 -> 300 em 10 s faz o timecode",
                "      andar em tempo real a 30 fps.",
                "      Atalho: no Slider, use a expressão  time * 30",
                "",
                "   Dica: para outro fps, troque os dois 30 pelo fps desejado.",
                "   ============================================================ */",
                "",
                "v = Math.floor(effect(\"Slider Control\")(\"Slider\")); // total de frames",
                "",
                "minutos = Math.floor(v / 30); // segundos (30 frames = 1 s)",
                "segundos = v % 30;            // frames que sobram",
                "",
                "minTxt = (minutos < 10) ? (\"0\" + minutos) : minutos.toString();",
                "segTxt = (segundos < 10) ? (\"0\" + segundos) : segundos.toString();",
                "",
                "// texto fixo + timecode",
                "\"00:00:\" + minTxt + \":\" + segTxt;"
            ].join("\n")
        },
        {
            name: "Caixa reativa — Anchor Point do texto",
            cat: "Layout",
            target: "Anchor Point (camada de texto)",
            desc: "Parte 1 da caixa reativa: centraliza o Anchor Point do texto, para o texto e a caixa ficarem alinhados pelo centro.",
            needs: [],
            code: [
                "/* ============================================================",
                "   CAIXA REATIVA — PARTE 1: ANCHOR POINT DO TEXTO",
                "   Aplicar em: Anchor Point da camada de TEXTO",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Coloca o Anchor Point exatamente no centro do texto, seja qual",
                "   for o tamanho. Assim o texto cresce para os dois lados e fica",
                "   alinhado com a caixa.",
                "",
                "   Como usar (junto com a Parte 2):",
                "   1. Troque \"nome da camada\" pelo nome da sua camada de texto",
                "      (pode ser a própria camada: thisLayer também funciona).",
                "   2. Cole no Anchor Point do texto.",
                "   3. Na caixa (shape), use o atalho \"Caixa reativa — Size da",
                "      caixa\".",
                "   4. Alinhe texto e caixa na mesma posição (ou faça parent).",
                "   ============================================================ */",
                "",
                "///Camada de texto - Anchor Point:",
                "",
                "a = thisComp.layer(\"nome da camada\").sourceRectAtTime();",
                "",
                "Height = a.height;",
                "Width = a.width;",
                "Left = a.left;",
                "Top = a.top;",
                "",
                "// Centro do retângulo do texto",
                "x = Left + Width / 2;",
                "y = Top + Height / 2;",
                "",
                "[x, y]"
            ].join("\n")
        },
        {
            name: "Caixa reativa — Size da caixa",
            cat: "Layout",
            target: "Rectangle Path > Size (shape da caixa)",
            desc: "Parte 2 da caixa reativa: a caixa (shape) muda de tamanho sozinha conforme o texto, com margem controlada por um Slider.",
            needs: ["Slider Control"],
            code: [
                "/* ============================================================",
                "   CAIXA REATIVA — PARTE 2: SIZE DA CAIXA",
                "   Aplicar em: Size do Rectangle Path da camada de SHAPE (caixa)",
                "   Precisa de: efeito \"Slider Control\" na camada da caixa",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Lê o tamanho do texto e faz o retângulo ter esse tamanho mais",
                "   uma margem (o valor do Slider). Mudou o texto, a caixa",
                "   acompanha.",
                "",
                "   Como usar:",
                "   1. Crie um retângulo (shape layer > Rectangle).",
                "   2. Adicione um Slider Control na camada da caixa (o painel",
                "      cria sozinho se faltar). Ele é a margem em px.",
                "   3. Troque \"nome da camada\" pelo nome da camada de texto.",
                "   4. Cole no Size do Rectangle Path.",
                "   5. Use a Parte 1 no Anchor Point do texto para centralizar.",
                "",
                "   Dica: a margem é somada no total; com Slider 40 sobram 20 px",
                "   de cada lado.",
                "   ============================================================ */",
                "",
                "///Camada da Box - Size dentro dos parâmetros:",
                "",
                "a = thisComp.layer(\"nome da camada\").sourceRectAtTime();",
                "",
                "Height = a.height;",
                "Width = a.width;",
                "",
                "p = effect(\"Slider Control\")(\"Slider\"); // margem",
                "x = Width + p;",
                "y = Height + p;",
                "",
                "[x, y]"
            ].join("\n")
        },
        {
            name: "Tamanho por sliders (Largura/Altura)",
            cat: "Layout",
            target: "Rectangle Path > Size",
            desc: "Controla o tamanho de um retângulo por dois sliders numa camada CONTROLES. Bom para centralizar vários controles num lugar só.",
            needs: [],
            code: [
                "/* ============================================================",
                "   TAMANHO POR SLIDERS",
                "   Aplicar em: Size do Rectangle Path (ou qualquer valor [x, y])",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Pega a largura e a altura de dois Sliders numa camada de",
                "   controle. Várias caixas podem usar os mesmos sliders e mudar",
                "   juntas.",
                "",
                "   Como usar:",
                "   1. Crie um Null chamado CONTROLES.",
                "   2. Adicione dois Slider Control nele e renomeie para",
                "      \"Largura\" e \"Altura\".",
                "   3. Cole esta expressão no Size do Rectangle Path da caixa.",
                "   4. Mexa nos sliders do CONTROLES.",
                "   ============================================================ */",
                "",
                "w = thisComp.layer(\"CONTROLES\").effect(\"Largura\")(\"Slider\");",
                "h = thisComp.layer(\"CONTROLES\").effect(\"Altura\")(\"Slider\");",
                "",
                "[w, h]"
            ].join("\n")
        },
        {
            name: "Escala constante pela câmera (Scale x Z)",
            cat: "3D",
            target: "Scale (camada 3D)",
            desc: "Mantém o tamanho aparente da camada igual mesmo quando ela se aproxima ou se afasta da câmera.",
            needs: [],
            code: [
                "/* ============================================================",
                "   ESCALA CONSTANTE PELA CÂMERA (Scale x Position Z)",
                "   Aplicar em: Scale de uma camada 3D",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Calcula a distância entre a camada e a câmera ativa e corrige",
                "   a escala na mesma proporção. Resultado: a camada parece",
                "   sempre do mesmo tamanho na tela, mesmo mudando o Z ou com a",
                "   câmera se movendo. Ótimo para textos, ícones e marcadores",
                "   que acompanham uma cena 3D.",
                "",
                "   Como usar:",
                "   1. Ligue o 3D da camada e tenha uma câmera na comp.",
                "   2. Cole esta expressão na Scale.",
                "   3. A escala fica 100% quando a camada está à distância do",
                "      Zoom da câmera.",
                "",
                "   Observações:",
                "   - Sem câmera na comp, a escala original é mantida.",
                "   - Use em camadas sem parent (a posição usada é a local).",
                "   ============================================================ */",
                "",
                "try {",
                "    // Busca a câmera ativa na composição",
                "    cam = thisComp.activeCamera;",
                "",
                "    // Calcula a distância da câmera até o Ponto de Ancoragem da camada",
                "    distance = length(sub(position, cam.position));",
                "",
                "    // Calcula a distância focal da câmera (ponto onde a escala é 100%)",
                "    zoom = cam.zoom;",
                "",
                "    // Cria o fator de escala invertido",
                "    scaleFactor = (distance / zoom) * 100;",
                "",
                "    // Aplica o fator nos eixos X, Y e Z",
                "    [scaleFactor, scaleFactor, scaleFactor];",
                "} catch(err) {",
                "    // Caso não haja câmera na cena, mantém a escala original para não dar erro",
                "    value;",
                "}"
            ].join("\n")
        },
        {
            name: "Desacelerar até parar",
            cat: "Movimento",
            target: "Rotation (ou qualquer valor 1D)",
            desc: "Movimento que começa rápido e vai freando até parar, como uma roda girando. Física de movimento uniformemente variado.",
            needs: [],
            code: [
                "/* ============================================================",
                "   DESACELERAR ATÉ PARAR",
                "   Aplicar em: Rotation (ou qualquer propriedade de 1 valor:",
                "               opacidade, X Position separado, Slider...)",
                "   ------------------------------------------------------------",
                "   O que faz:",
                "   Simula algo que começa com velocidade vInicial e vai freando",
                "   (desaceleracao por segundo) até parar, e depois fica parado.",
                "   Ex.: uma roleta girando e parando.",
                "",
                "   Como usar:",
                "   1. Cole na Rotation da camada.",
                "   2. vInicial = velocidade no começo (graus por segundo).",
                "   3. desaceleracao = quanto a velocidade cai por segundo.",
                "      Ex.: 150 e 20 -> para em 7,5 s, depois de girar 562,5°.",
                "",
                "   Observações:",
                "   - O valor substitui o da propriedade. Para somar à rotação",
                "     que você já tem, troque a última linha por",
                "     value + (vInicial * t) - (desaceleracao * Math.pow(t, 2) / 2);",
                "   - Em Position (2D), separe as dimensões e use no X ou no Y.",
                "   ============================================================ */",
                "",
                "var vInicial = 150;     // Velocidade no início",
                "var desaceleracao = 20; // Quanto diminui por segundo",
                "var tOriginal = Math.max(0, time); // Garante que o tempo não seja negativo",
                "",
                "// 1. Calcula em quanto tempo a velocidade chega a zero",
                "var tempoParaParar = vInicial / desaceleracao;",
                "",
                "// 2. Garante que o tempo usado no cálculo nunca ultrapasse o ponto de parada",
                "var t = Math.min(tOriginal, tempoParaParar);",
                "",
                "// 3. Aplica a fórmula de deslocamento (MUV)",
                "(vInicial * t) - (desaceleracao * Math.pow(t, 2) / 2);"
            ].join("\n")
        }
    ];

    // Caminho de uma propriedade a partir da layer (índices), para reencontrar
    // a propriedade depois de adicionar efeitos (o AE invalida as referências).
    function propertyPath(prop) {
        var path = [];
        var p = prop;

        while (p.parentProperty) {
            path.unshift(p.propertyIndex);
            p = p.parentProperty;
        }

        return {layer: p, path: path};
    }

    function resolvePropertyPath(ref) {
        var p = ref.layer;
        for (var i = 0; i < ref.path.length; i++) p = p.property(ref.path[i]);
        return p;
    }

    // Garante que a layer tenha um Slider Control com esse nome.
    function ensureSliderControl(layer, name) {
        var parade = layer.property("ADBE Effect Parade");
        if (!parade) return false;
        if (parade.property(name)) return false;

        var fx = parade.addProperty("ADBE Slider Control");
        fx.name = name;
        return true;
    }

    function buildExpressionsTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = [0, 6, 0, 0];

        var ALL = "Todas";
        var MINE = "★ Minhas";

        var favorites = loadExpressionFavorites();
        var shown = [];     // entradas visíveis na lista, na mesma ordem
        var current = null; // entrada carregada no editor
        var busy = false;

        // ----- Lista -----
        var libSec = uiSection(tab, "Atalhos e favoritas");

        var filterRow = libSec.add("group");
        filterRow.orientation = "row";
        filterRow.alignChildren = ["fill", "center"];

        var ddCat = filterRow.add("dropdownlist", undefined, []);
        ddCat.preferredSize.width = 120;

        var txtSearch = filterRow.add("edittext", undefined, "");
        txtSearch.alignment = ["fill", "center"];
        txtSearch.helpTip = "Buscar por nome ou descrição";

        var list = libSec.add("listbox", undefined, [], {
            multiselect: false,
            numberOfColumns: 2,
            showHeaders: true,
            columnTitles: ["Expressão", "Aplicar em"],
            columnWidths: [230, 150]
        });
        list.alignment = ["fill", "fill"];
        list.preferredSize.height = 170;

        var infoText = libSec.add("statictext", undefined, "", {multiline: true});
        infoText.alignment = ["fill", "top"];
        infoText.preferredSize.height = 58;
        uiColorText(infoText, THEME.textDim);

        // ----- Editor -----
        var edSec = uiSection(tab, "Expressão");

        var nameRow = edSec.add("group");
        nameRow.orientation = "row";
        nameRow.alignChildren = ["fill", "center"];

        uiLabel(nameRow, "Nome:");
        var txtName = nameRow.add("edittext", undefined, "");
        txtName.alignment = ["fill", "center"];
        txtName.characters = 24;

        var txtCode = edSec.add("edittext", undefined, "", {
            multiline: true,
            scrolling: true,
            wantReturn: true
        });
        txtCode.alignment = ["fill", "fill"];
        txtCode.preferredSize.height = 200;

        var manageRow = edSec.add("group");
        manageRow.orientation = "row";
        manageRow.alignChildren = ["fill", "center"];
        manageRow.spacing = 4;

        var btnNew = uiButton(manageRow, "Nova", {tip: "Limpa o editor"});
        var btnSave = uiButton(manageRow, "Salvar", {tip: "Salva nas suas favoritas (★ Minhas)"});
        var btnDelete = uiButton(manageRow, "Excluir", {tip: "Exclui uma das suas favoritas"});
        var btnCapture = uiButton(manageRow, "Capturar", {tip: "Copia a expressão da propriedade selecionada"});

        // ----- Aplicar -----
        var applySec = uiSection(tab, "Aplicar");

        var cbNeeds = applySec.add("checkbox", undefined, "Criar Slider Control na camada se a expressão precisar");
        cbNeeds.value = loadSetting("exprCreateControls", "1") === "1";

        var btnApply = uiButton(applySec, "APLICAR NAS PROPRIEDADES SELECIONADAS", {primary: true});

        var status = addStatus(tab, "Clique num atalho para ver o tutorial. Duplo clique aplica direto.");

        // ----- lógica -----

        function allEntries() {
            var out = [];
            var i;

            for (i = 0; i < EXPRESSION_LIBRARY.length; i++) {
                var e = EXPRESSION_LIBRARY[i];
                out.push({
                    kind: "lib",
                    name: e.name,
                    cat: e.cat,
                    target: e.target,
                    desc: e.desc,
                    needs: e.needs,
                    code: e.code
                });
            }

            for (i = 0; i < favorites.length; i++) {
                out.push({
                    kind: "user",
                    name: favorites[i].name,
                    cat: MINE,
                    target: "—",
                    desc: "",
                    needs: [],
                    code: favorites[i].code
                });
            }

            return out;
        }

        function refreshCategories() {
            busy = true;
            var keep = ddCat.selection ? ddCat.selection.text : loadSetting("exprCategory", ALL);
            var names = [ALL, MINE];
            var seen = {};

            for (var i = 0; i < EXPRESSION_LIBRARY.length; i++) {
                var c = EXPRESSION_LIBRARY[i].cat;
                if (!seen["k" + c]) {
                    seen["k" + c] = true;
                    names.push(c);
                }
            }

            ddCat.removeAll();
            var pick = 0;

            for (i = 0; i < names.length; i++) {
                ddCat.add("item", names[i]);
                if (names[i] === keep) pick = i;
            }

            ddCat.selection = pick;
            busy = false;
        }

        function refreshList(keepName) {
            var cat = ddCat.selection ? ddCat.selection.text : ALL;
            var q = trimString(txtSearch.text).toLowerCase();
            var entries = allEntries();

            busy = true;
            list.removeAll();
            shown = [];

            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];

                if (cat !== ALL && e.cat !== cat) continue;

                if (
                    q !== "" &&
                    e.name.toLowerCase().indexOf(q) === -1 &&
                    e.desc.toLowerCase().indexOf(q) === -1
                ) {
                    continue;
                }

                var item = list.add("item", (e.kind === "user" ? "★ " : "") + e.name);
                try { item.subItems[0].text = e.target; } catch (eSub) {}

                shown.push(e);

                if (keepName && keepName === e.name) list.selection = item;
            }

            busy = false;
        }

        function describe(e) {
            if (!e) {
                infoText.text = "";
                return;
            }

            if (e.kind === "user") {
                infoText.text = "Expressão salva por você.";
                return;
            }

            infoText.text =
                e.desc + "\n" +
                "Aplicar em: " + e.target +
                (e.needs.length ? "   ·   Precisa de: " + e.needs.join(", ") : "");
        }

        function loadSelected() {
            if (busy || !list.selection) return;

            var e = shown[list.selection.index];
            if (!e) return;

            current = e;
            txtName.text = e.name;
            txtCode.text = e.code;
            describe(e);
            status.text = (e.kind === "lib" ? "Atalho: " : "Favorita: ") + e.name;
        }

        function applyCurrentExpression() {
            var code = txtCode.text;

            if (trimString(code) === "") {
                alert("A expressão está vazia.");
                return;
            }

            var props = collectSelectedExpressionProperties();

            if (props.length === 0) {
                alert("Selecione uma ou mais propriedades que aceitem expressão.");
                return;
            }

            // Só cria controles se a expressão no editor ainda é a do atalho.
            var needs = (current && current.kind === "lib" && current.code === code) ? current.needs : [];
            var applied = 0;
            var created = 0;
            var errors = [];
            var warnings = [];
            var i;

            saveSetting("exprCreateControls", cbNeeds.value ? "1" : "0");

            app.beginUndoGroup("Mesmo Tools - Expressão" + (current ? " " + current.name : ""));

            try {
                if (needs.length && cbNeeds.value) {
                    var refs = [];
                    for (i = 0; i < props.length; i++) refs.push(propertyPath(props[i]));

                    for (i = 0; i < refs.length; i++) {
                        for (var n = 0; n < needs.length; n++) {
                            try {
                                if (ensureSliderControl(refs[i].layer, needs[n])) created++;
                            } catch (eFx) {}
                        }
                    }

                    // Adicionar efeitos invalida as referências: reencontra as propriedades.
                    props = [];
                    for (i = 0; i < refs.length; i++) {
                        try { props.push(resolvePropertyPath(refs[i])); } catch (eRes) {}
                    }
                }

                for (i = 0; i < props.length; i++) {
                    var propName = "Propriedade";
                    try { propName = props[i].name; } catch (nameErr) {}

                    try {
                        props[i].expression = code;
                        applied++;

                        // O AE aceita a expressão mesmo com erro; avisa se ela quebrou.
                        var exprErr = "";
                        try { exprErr = props[i].expressionError; } catch (eErr) {}
                        if (exprErr) warnings.push(propName + ": " + exprErr);
                    } catch (e) {
                        errors.push(propName + ": " + e.toString().replace("Error: ", ""));
                    }
                }
            } finally {
                app.endUndoGroup();
            }

            status.text =
                applied + " propriedade(s) atualizada(s)" +
                (created ? " | " + created + " Slider Control criado(s)" : "") +
                (errors.length ? " | " + errors.length + " erro(s)" : "") +
                (warnings.length ? " | " + warnings.length + " com erro de expressão" : "") +
                ".";

            if (errors.length || warnings.length) {
                var msg = "";
                if (errors.length) {
                    msg += "Não foi possível aplicar em:\n" + errors.join("\n");
                }
                if (warnings.length) {
                    if (msg) msg += "\n\n";
                    msg += "Aplicada, mas a expressão deu erro em:\n" + warnings.join("\n") +
                        "\n\nConfira o tutorial no topo da expressão: às vezes falta " +
                        "renomear uma camada ou criar um controle.";
                }
                alert(msg);
            }
        }

        ddCat.onChange = function () {
            if (busy || !ddCat.selection) return;
            saveSetting("exprCategory", ddCat.selection.text);
            refreshList(current ? current.name : null);
        };

        txtSearch.onChanging = function () {
            refreshList(current ? current.name : null);
        };

        list.onChange = loadSelected;

        list.onDoubleClick = function () {
            loadSelected();
            applyCurrentExpression();
        };

        btnNew.onClick = function () {
            current = null;
            list.selection = null;
            txtName.text = "";
            txtCode.text = "";
            describe(null);
            status.text = "Nova expressão: escreva ou capture, dê um nome e salve.";
        };

        btnSave.onClick = function () {
            var name = trimString(txtName.text);
            var code = txtCode.text;

            if (name === "") {
                alert("Dê um nome para a expressão.");
                return;
            }

            if (trimString(code) === "") {
                alert("A expressão está vazia.");
                return;
            }

            // Um atalho do Mesmo nunca é sobrescrito: vira uma cópia sua.
            for (var i = 0; i < EXPRESSION_LIBRARY.length; i++) {
                if (EXPRESSION_LIBRARY[i].name === name) {
                    name += " (minha)";
                    break;
                }
            }

            var idx = findFavoriteIndex(favorites, name);

            if (idx === -1) favorites.push({name: name, code: code});
            else favorites[idx].code = code;

            if (saveExpressionFavorites(favorites)) {
                current = {kind: "user", name: name, cat: MINE, target: "—", desc: "", needs: [], code: code};
                txtName.text = name;
                refreshList(name);
                describe(current);
                status.text = "Salva em ★ Minhas: " + name;
            }
        };

        btnDelete.onClick = function () {
            if (current && current.kind === "lib") {
                alert("Os atalhos do Mesmo não podem ser excluídos. Só as suas favoritas (★ Minhas).");
                return;
            }

            var name = trimString(txtName.text);
            if (name === "" && current) name = current.name;

            var idx = findFavoriteIndex(favorites, name);

            if (idx === -1) {
                alert("Selecione uma das suas favoritas para excluir.");
                return;
            }

            if (!confirm("Excluir a expressão \"" + name + "\"?")) return;

            favorites.splice(idx, 1);

            if (saveExpressionFavorites(favorites)) {
                current = null;
                txtName.text = "";
                txtCode.text = "";
                describe(null);
                refreshList(null);
                status.text = "Expressão excluída: " + name;
            }
        };

        btnCapture.onClick = function () {
            var props = collectSelectedExpressionProperties();

            if (props.length === 0) {
                alert("Selecione uma propriedade com expressão.");
                return;
            }

            var captured = "";
            try { captured = props[0].expression; } catch (e) {}

            if (trimString(captured) === "") {
                alert("A primeira propriedade selecionada não tem expressão.");
                return;
            }

            current = null;
            list.selection = null;
            txtCode.text = captured;
            describe(null);

            if (trimString(txtName.text) === "") {
                try { txtName.text = props[0].name; } catch (nameErr) { txtName.text = "Expressão"; }
            }

            status.text = "Expressão capturada. Dê um nome e salve.";
        };

        btnApply.onClick = applyCurrentExpression;

        refreshCategories();
        refreshList(null);
    }

    // ================================================================
    // CURVAS — biblioteca de curvas de velocidade
    // Cada curva é um cubic-bezier normalizado (x1, y1, x2, y2), igual ao
    // CSS e ao cubic-bezier.com. Na hora de aplicar, ele é convertido para
    // speed + influence das keyframes do After Effects.
    // ================================================================

    var CURVE_DEFAULTS = [
        // nome, categoria, x1, y1, x2, y2, favorita
        ["Linear", "Básicas", 0.333, 0.333, 0.667, 0.667, 0],
        ["Easy Ease (AE)", "Básicas", 0.333, 0, 0.667, 1, 1],
        ["Easy Ease In (AE)", "Básicas", 0.167, 0.167, 0.667, 1, 0],
        ["Easy Ease Out (AE)", "Básicas", 0.333, 0, 0.833, 0.833, 0],
        ["In Sine", "Sine", 0.12, 0, 0.39, 0, 0],
        ["Out Sine", "Sine", 0.61, 1, 0.88, 1, 0],
        ["InOut Sine", "Sine", 0.37, 0, 0.63, 1, 0],
        ["In Cubic", "Cubic", 0.32, 0, 0.67, 0, 0],
        ["Out Cubic", "Cubic", 0.33, 1, 0.68, 1, 0],
        ["InOut Cubic", "Cubic", 0.65, 0, 0.35, 1, 1],
        ["In Quint", "Quint", 0.64, 0, 0.78, 0, 0],
        ["Out Quint", "Quint", 0.22, 1, 0.36, 1, 0],
        ["InOut Quint", "Quint", 0.83, 0, 0.17, 1, 0],
        ["In Expo", "Expo", 0.7, 0, 0.84, 0, 0],
        ["Out Expo", "Expo", 0.16, 1, 0.3, 1, 1],
        ["InOut Expo", "Expo", 0.87, 0, 0.13, 1, 0],
        ["In Back", "Back", 0.36, 0, 0.66, -0.56, 0],
        ["Out Back", "Back", 0.34, 1.56, 0.64, 1, 0],
        ["InOut Back", "Back", 0.68, -0.6, 0.32, 1.6, 0],
        ["Standard", "Material", 0.4, 0, 0.2, 1, 1],
        ["Emphasized Out", "Material", 0.05, 0.7, 0.1, 1, 0],
        ["Emphasized In", "Material", 0.3, 0, 0.8, 0.15, 0]
    ];

    function round3(v) {
        return Math.round(v * 1000) / 1000;
    }

    function makeCurve(name, cat, x1, y1, x2, y2, fav) {
        return {
            name: String(name),
            cat: String(cat || "Minhas"),
            x1: round3(Math.max(0, Math.min(1, x1))),
            y1: round3(y1),
            x2: round3(Math.max(0, Math.min(1, x2))),
            y2: round3(y2),
            fav: !!fav
        };
    }

    function defaultCurves() {
        var out = [];
        for (var i = 0; i < CURVE_DEFAULTS.length; i++) {
            var d = CURVE_DEFAULTS[i];
            out.push(makeCurve(d[0], d[1], d[2], d[3], d[4], d[5], d[6]));
        }
        return out;
    }

    function curveValuesText(c) {
        return c.x1 + ", " + c.y1 + ", " + c.x2 + ", " + c.y2;
    }

    // Aceita "0.4, 0, 0.2, 1", "cubic-bezier(.4,0,.2,1)" ou "0,4; 0; 0,2; 1".
    function parseCurveValues(s) {
        s = String(s);
        var nums = [];
        var i;

        if (s.indexOf(";") !== -1) {
            var parts = s.replace(/[^\d.,;\-]/g, "").split(";");
            for (i = 0; i < parts.length; i++) {
                if (parts[i] !== "") nums.push(parseFloat(parts[i].replace(",", ".")));
            }
        } else {
            var m = s.match(/-?\d*\.?\d+/g) || [];
            for (i = 0; i < m.length; i++) nums.push(parseFloat(m[i]));
        }

        if (nums.length !== 4) return null;
        for (i = 0; i < 4; i++) if (isNaN(nums[i])) return null;

        return nums;
    }

    // ---------- leitura e gravação ----------

    function getCurveStoreFile() {
        var dir = new Folder(Folder.userData.fsName + "/MesmoTools");
        if (!dir.exists) {
            try { dir.create(); } catch (e) {}
        }
        return new File(dir.fsName + "/speed_curves.txt");
    }

    function readCurveFile(f) {
        if (!f || !f.exists) return null;

        var out = [];

        try {
            f.encoding = "UTF-8";
            if (!f.open("r")) return null;

            while (!f.eof) {
                var line = f.readln();
                if (line === "" || line.charAt(0) === "#") continue;

                var fields = line.split("\t");
                if (fields.length < 3) continue;

                try {
                    var v = parseCurveValues(fields[2]);
                    if (!v) continue;

                    out.push(makeCurve(
                        decodeURIComponent(fields[0]),
                        decodeURIComponent(fields[1]),
                        v[0], v[1], v[2], v[3],
                        fields[3] === "1"
                    ));
                } catch (lineErr) {}
            }

            f.close();
        } catch (e) {
            try { f.close(); } catch (closeErr) {}
            return null;
        }

        return out;
    }

    function writeCurveFile(f, curves) {
        try {
            f.encoding = "UTF-8";
            f.lineFeed = "Unix";

            if (!f.open("w")) throw new Error("Não foi possível abrir o arquivo.");

            f.writeln("# Mesmo Tools speed curves v1 | nome<TAB>categoria<TAB>x1,y1,x2,y2<TAB>favorita");

            for (var i = 0; i < curves.length; i++) {
                var c = curves[i];
                f.writeln(
                    encodeURIComponent(c.name) + "\t" +
                    encodeURIComponent(c.cat) + "\t" +
                    c.x1 + "," + c.y1 + "," + c.x2 + "," + c.y2 + "\t" +
                    (c.fav ? "1" : "0")
                );
            }

            f.close();
            return true;
        } catch (e) {
            try { f.close(); } catch (closeErr) {}
            alert(
                "Não foi possível salvar as curvas:\n" +
                e.toString().replace("Error: ", "") + WRITE_HELP
            );
            return false;
        }
    }

    function findCurveIndex(curves, name) {
        for (var i = 0; i < curves.length; i++) {
            if (curves[i].name === name) return i;
        }
        return -1;
    }

    // ---------- conversão bezier <-> keyframes do AE ----------

    function isCurveCompatibleProperty(p) {
        try {
            if (p.propertyType !== PropertyType.PROPERTY) return false;
            if (!p.canVaryOverTime || p.numKeys < 2) return false;

            var vt = p.propertyValueType;
            if (
                vt === PropertyValueType.NO_VALUE ||
                vt === PropertyValueType.CUSTOM_VALUE ||
                vt === PropertyValueType.SHAPE ||
                vt === PropertyValueType.TEXT_DOCUMENT ||
                vt === PropertyValueType.MARKER ||
                vt === PropertyValueType.LAYER_INDEX ||
                vt === PropertyValueType.MASK_INDEX
            ) {
                return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    // Diferença de valor entre duas keys, no formato que o ease espera:
    // 1 dimensão -> [delta]; espacial (ease único) -> [distância]; N dims -> [d1, d2...]
    function keyDeltas(prop, k1, k2, easeLen) {
        var v1 = prop.keyValue(k1);
        var v2 = prop.keyValue(k2);
        var i;

        if (typeof v1 === "number") return [v2 - v1];

        if (v1 instanceof Array) {
            if (easeLen === 1) {
                var sum = 0;
                for (i = 0; i < v1.length; i++) {
                    sum += (v2[i] - v1[i]) * (v2[i] - v1[i]);
                }
                return [Math.sqrt(sum)];
            }

            var out = [];
            for (i = 0; i < easeLen; i++) out.push((v2[i] || 0) - (v1[i] || 0));
            return out;
        }

        return null;
    }

    /*
        Conversão (mesma ideia do Flow):
        saída da 1ª key:   influence = x1 * 100,       speed = (y1 / x1) * velocidadeMédia
        entrada da 2ª key: influence = (1 - x2) * 100, speed = ((1 - y2) / (1 - x2)) * velocidadeMédia
        mode: "both" | "out" | "in"
    */
    function applyCurveToSegment(prop, k1, k2, c, mode) {
        var dt = prop.keyTime(k2) - prop.keyTime(k1);
        if (dt <= 0) return false;

        var easeLen = prop.keyOutTemporalEase(k1).length;
        var deltas = keyDeltas(prop, k1, k2, easeLen);
        if (!deltas) throw new Error("tipo de propriedade não suportado.");

        var x1 = Math.max(0.001, Math.min(1, c.x1));
        var x2 = Math.max(0, Math.min(0.999, c.x2));
        var outInf = Math.max(0.1, Math.min(100, x1 * 100));
        var inInf = Math.max(0.1, Math.min(100, (1 - x2) * 100));
        var outEase = [];
        var inEase = [];

        for (var d = 0; d < easeLen; d++) {
            var avg = deltas[d] / dt;
            outEase.push(new KeyframeEase((c.y1 / x1) * avg, outInf));
            inEase.push(new KeyframeEase(((1 - c.y2) / (1 - x2)) * avg, inInf));
        }

        var BEZ = KeyframeInterpolationType.BEZIER;

        if (mode !== "in") {
            prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), BEZ);
            try { prop.setTemporalContinuousAtKey(k1, false); } catch (e1) {}
            try { prop.setTemporalAutoBezierAtKey(k1, false); } catch (e2) {}
            prop.setTemporalEaseAtKey(k1, prop.keyInTemporalEase(k1), outEase);
        }

        if (mode !== "out") {
            prop.setInterpolationTypeAtKey(k2, BEZ, prop.keyOutInterpolationType(k2));
            try { prop.setTemporalContinuousAtKey(k2, false); } catch (e3) {}
            try { prop.setTemporalAutoBezierAtKey(k2, false); } catch (e4) {}
            prop.setTemporalEaseAtKey(k2, inEase, prop.keyOutTemporalEase(k2));
        }

        return true;
    }

    // Segmentos [prop, k1, k2] a partir das keyframes selecionadas na comp ativa.
    function collectCurveSegments(comp) {
        var props = [];
        var segments = [];
        var skipped = 0;
        var i;

        function addProp(p) {
            if (!p) return;
            for (var k = 0; k < props.length; k++) if (props[k] === p) return;
            props.push(p);
        }

        try {
            var cp = comp.selectedProperties;
            for (i = 0; i < cp.length; i++) addProp(cp[i]);
        } catch (e1) {}

        try {
            var layers = comp.selectedLayers;
            for (i = 0; i < layers.length; i++) {
                var lp = layers[i].selectedProperties;
                for (var j = 0; j < lp.length; j++) addProp(lp[j]);
            }
        } catch (e2) {}

        for (i = 0; i < props.length; i++) {
            var p = props[i];
            var keys;

            try {
                if (p.propertyType !== PropertyType.PROPERTY) continue;
                keys = p.selectedKeys;
                if (!keys || keys.length === 0) continue;
            } catch (e3) {
                continue;
            }

            if (!isCurveCompatibleProperty(p)) {
                skipped++;
                continue;
            }

            keys = keys.slice(0).sort(function (a, b) { return a - b; });

            if (keys.length === 1) {
                if (keys[0] < p.numKeys) segments.push([p, keys[0], keys[0] + 1]);
                else segments.push([p, keys[0] - 1, keys[0]]);
                continue;
            }

            for (var s = 0; s < keys.length - 1; s++) {
                if (keys[s + 1] === keys[s] + 1) segments.push([p, keys[s], keys[s + 1]]);
            }
        }

        return {segments: segments, skipped: skipped};
    }

    // ---------- aba ----------
    // Tudo ao vivo: escolher uma curva no dropdown, arrastar as alças ou
    // digitar os valores já muda as keyframes selecionadas na timeline.

    function buildCurvesTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = [0, 6, 0, 0];

        var ED_RANGE = [-0.6, 1.6];
        var ED_PAD = 12;
        var LIVE_INTERVAL = 60; // ms entre aplicações durante o arraste

        var curves = readCurveFile(getCurveStoreFile());
        if (!curves) {
            curves = defaultCurves();
            try { writeCurveFile(getCurveStoreFile(), curves); } catch (eSeed) {}
        }

        var lib = {
            selected: null,
            edit: makeCurve("", "Minhas", 0.333, 0, 0.667, 1, false),
            busy: false,
            ddMap: []
        };

        // ----- Biblioteca (dropdown) -----
        var libRow = tab.add("group");
        libRow.orientation = "row";
        libRow.alignChildren = ["fill", "center"];
        libRow.spacing = 4;

        var ddCurves = libRow.add("dropdownlist", undefined, []);
        ddCurves.alignment = ["fill", "center"];
        ddCurves.helpTip = "Escolha uma curva: ela já é aplicada nas keyframes selecionadas";

        var btnFav = uiButton(libRow, "★", {width: 28, tip: "Favoritar / desfavoritar (favoritas aparecem no topo)"});

        // ----- Editor -----
        var edRow = tab.add("group");
        edRow.orientation = "row";
        edRow.alignChildren = ["left", "top"];
        edRow.spacing = 8;

        var editor = edRow.add("group");
        editor.alignment = ["left", "top"];
        editor.preferredSize = [128, 128];
        editor.helpTip = "Arraste as alças: as keyframes selecionadas mudam na hora. Shift arredonda.";

        var edSide = edRow.add("group");
        edSide.orientation = "column";
        edSide.alignment = ["fill", "top"];
        edSide.alignChildren = ["fill", "top"];
        edSide.spacing = 5;

        function sideRow(label) {
            var r = edSide.add("group");
            r.orientation = "row";
            r.alignChildren = ["fill", "center"];
            var l = uiLabel(r, label);
            l.preferredSize.width = 58;
            return r;
        }

        // Modo do gráfico: Valor (curva bezier) ou Velocidade (speed graph do AE)
        var modeRow = sideRow("Gráfico:");
        modeRow.spacing = 2;
        var btnModeValue = uiButton(modeRow, "Valor", {tip: "Curva de valor (como o Value Graph)"});
        var btnModeSpeed = uiButton(modeRow, "Velocidade", {tip: "Curva de velocidade (como o Speed Graph): alças = influência e speed"});
        uiFlex(btnModeValue, 30);
        uiFlex(btnModeSpeed, 30);

        var txtValues = uiFlex(sideRow("Bezier:").add("edittext", undefined, ""));
        txtValues.helpTip = "x1, y1, x2, y2 — pode colar do cubic-bezier.com. Enter aplica.";

        var infoText = uiFlex(uiLabel(edSide, ""));
        infoText.helpTip = "Influência (%) e velocidade (× a velocidade média do trecho) de cada keyframe.";

        var txtName = sideRow("Nome:").add("edittext", undefined, "");
        uiFlex(txtName);

        var txtCat = sideRow("Categoria:").add("edittext", undefined, "Minhas");
        uiFlex(txtCat);
        txtCat.helpTip = "Digite uma categoria existente ou crie uma nova";

        var manageRow = edSide.add("group");
        manageRow.orientation = "row";
        manageRow.alignChildren = ["fill", "center"];
        manageRow.spacing = 4;

        var btnSave = uiButton(manageRow, "Salvar", {tip: "Salva na biblioteca (atualiza se o nome já existir)"});
        var btnDelete = uiButton(manageRow, "Excluir");

        var cbLive = uiFlex(tab.add("checkbox", undefined, "Ao vivo nas keyframes selecionadas"));
        cbLive.value = loadSetting("curvesLive", "1") === "1";

        var status = addStatus(tab, "Selecione keyframes e mexa no editor.");

        // ----- desenho do editor -----

        lib.mode = loadSetting("curvesGraph", "value") === "speed" ? "speed" : "value";

        function edBox() {
            var w = editor.size[0];
            var h = editor.size[1];
            return {x: ED_PAD, y: ED_PAD, w: w - ED_PAD * 2, h: h - ED_PAD * 2};
        }

        // Velocidades relativas à velocidade média do trecho (1 = média).
        function speedsOf(c) {
            var x1 = Math.max(0.001, c.x1);
            var x2 = Math.min(0.999, c.x2);
            return {s1: c.y1 / x1, s2: (1 - c.y2) / (1 - x2)};
        }

        // Velocidade ao longo do tempo: pontos [x, v] amostrados da bezier.
        function speedSamples(c) {
            var out = [];
            for (var i = 0; i <= 40; i++) {
                var t = i / 40;
                var mt = 1 - t;
                var dx = 3 * mt * mt * c.x1 + 6 * mt * t * (c.x2 - c.x1) + 3 * t * t * (1 - c.x2);
                var dy = 3 * mt * mt * c.y1 + 6 * mt * t * (c.y2 - c.y1) + 3 * t * t * (1 - c.y2);
                if (Math.abs(dx) < 1e-6) continue;
                out.push([bezierPoint(c, t)[0], dy / dx]);
            }
            return out;
        }

        function speedRangeOf(c) {
            var sp = speedsOf(c);
            var lo = Math.min(0, sp.s1, sp.s2);
            var hi = Math.max(2, sp.s1, sp.s2);
            var smp = speedSamples(c);
            for (var i = 0; i < smp.length; i++) {
                if (smp[i][1] < lo) lo = smp[i][1];
                if (smp[i][1] > hi) hi = smp[i][1];
            }
            var pad = (hi - lo) * 0.12;
            return [lo - pad, hi + pad];
        }

        // Faixa vertical: fixa no modo Valor; no modo Velocidade acompanha a
        // curva, mas fica congelada durante o arraste (senão a alça "foge").
        function yRange() {
            if (lib.mode !== "speed") return ED_RANGE;
            if (!lib.frozenRange) lib.speedRange = speedRangeOf(lib.edit);
            return lib.speedRange;
        }

        function edX(v, b) { return b.x + v * b.w; }
        function edY(v, b) { var r = yRange(); return b.y + b.h - (v - r[0]) / (r[1] - r[0]) * b.h; }
        function edInvX(px, b) { return (px - b.x) / b.w; }
        function edInvY(py, b) { var r = yRange(); return r[0] + (b.y + b.h - py) / b.h * (r[1] - r[0]); }

        // Onde estão as duas alças (em pixels) no modo atual.
        function handlePoints(b) {
            var e = lib.edit;
            if (lib.mode === "speed") {
                var sp = speedsOf(e);
                return [[edX(e.x1, b), edY(sp.s1, b)], [edX(e.x2, b), edY(sp.s2, b)]];
            }
            return [[edX(e.x1, b), edY(e.y1, b)], [edX(e.x2, b), edY(e.y2, b)]];
        }

        var drag = 0;

        function drawFrame(g, b, w, h) {
            uiRoundRect(g, 0, 0, w, h, 5);
            g.fillPath(uiBrush(g, THEME.well));

            g.newPath();
            g.rectPath(b.x, b.y, b.w, b.h);
            g.fillPath(uiBrush(g, THEME.grid));

            g.newPath();
            for (var i = 1; i < 4; i++) {
                var gx = Math.round(edX(i / 4, b)) + 0.5;
                g.moveTo(gx, b.y);
                g.lineTo(gx, b.y + b.h);
            }
            g.strokePath(uiPen(g, THEME.surface, 1));
        }

        function drawHandles(g, pts, anchors) {
            var i;

            g.newPath();
            for (i = 0; i < 2; i++) {
                g.moveTo(anchors[i][0], anchors[i][1]);
                g.lineTo(pts[i][0], pts[i][1]);
            }
            g.strokePath(uiPen(g, THEME.textDim, 1));

            for (i = 0; i < 2; i++) {
                g.newPath();
                g.rectPath(anchors[i][0] - 3, anchors[i][1] - 3, 6, 6);
                g.fillPath(uiBrush(g, THEME.text));
            }

            for (i = 0; i < 2; i++) {
                g.newPath();
                g.ellipsePath(pts[i][0] - 5, pts[i][1] - 5, 10, 10);
                g.fillPath(uiBrush(g, drag === i + 1 ? THEME.accent : THEME.text));
                g.newPath();
                g.ellipsePath(pts[i][0] - 5, pts[i][1] - 5, 10, 10);
                g.strokePath(uiPen(g, THEME.well, 2));
            }
        }

        editor.onDraw = function () {
            var g = this.graphics;
            var b = edBox();
            var e = lib.edit;
            var pts = handlePoints(b);
            var i;

            drawFrame(g, b, this.size[0], this.size[1]);

            if (lib.mode === "speed") {
                var sp = speedsOf(e);
                var y0 = Math.round(edY(0, b)) + 0.5;
                var yAvg = Math.round(edY(1, b)) + 0.5;

                // linha de velocidade zero e da velocidade média
                g.newPath();
                g.moveTo(b.x, y0);
                g.lineTo(b.x + b.w, y0);
                g.strokePath(uiPen(g, THEME.line, 1));

                g.newPath();
                for (i = 0; i < b.w; i += 6) {
                    g.moveTo(b.x + i, yAvg);
                    g.lineTo(b.x + Math.min(i + 3, b.w), yAvg);
                }
                g.strokePath(uiPen(g, THEME.surfaceHover, 1));

                var smp = speedSamples(e);
                g.newPath();
                for (i = 0; i < smp.length; i++) {
                    var px = edX(smp[i][0], b);
                    var py = edY(smp[i][1], b);
                    if (i === 0) g.moveTo(px, py);
                    else g.lineTo(px, py);
                }
                g.strokePath(uiPen(g, THEME.accent, 2.5));

                drawHandles(g, pts, [[edX(0, b), edY(sp.s1, b)], [edX(1, b), edY(sp.s2, b)]]);
            } else {
                var top = edY(1, b);
                var bottom = edY(0, b);

                g.newPath();
                g.moveTo(b.x, Math.round(bottom) + 0.5);
                g.lineTo(b.x + b.w, Math.round(bottom) + 0.5);
                g.moveTo(b.x, Math.round(top) + 0.5);
                g.lineTo(b.x + b.w, Math.round(top) + 0.5);
                g.strokePath(uiPen(g, THEME.surface, 1));

                g.newPath();
                g.moveTo(edX(0, b), bottom);
                g.lineTo(edX(1, b), top);
                g.strokePath(uiPen(g, THEME.line, 1));

                uiStrokeCurve(g, e, b.x, b.y, b.w, b.h, ED_RANGE, THEME.accent, 2.5);

                drawHandles(g, pts, [[edX(0, b), bottom], [edX(1, b), top]]);
            }
        };

        function setMode(m) {
            lib.mode = m;
            saveSetting("curvesGraph", m);
            btnModeValue.mesmoPrimary = m === "value";
            btnModeSpeed.mesmoPrimary = m === "speed";
            uiRedraw(btnModeValue);
            uiRedraw(btnModeSpeed);
            uiRedraw(editor);
        }

        btnModeValue.onClick = function () { setMode("value"); };
        btnModeSpeed.onClick = function () { setMode("speed"); };

        // ----- aplicar ao vivo -----

        var live = {segments: null, skipped: 0, last: 0};

        function now() {
            return new Date().getTime();
        }

        function findSegments() {
            var comp = app.project ? app.project.activeItem : null;
            if (!isComp(comp)) return {segments: [], skipped: 0};
            return collectCurveSegments(comp);
        }

        // Aplica a curva do editor nos trechos. Sem alertas: resultado vai no status.
        function applyToSegments(segments) {
            var ok = 0;
            var failed = 0;

            for (var i = 0; i < segments.length; i++) {
                try {
                    if (applyCurveToSegment(segments[i][0], segments[i][1], segments[i][2], lib.edit, "both")) ok++;
                } catch (e) {
                    failed++;
                }
            }

            return {ok: ok, failed: failed};
        }

        function liveStatus(r, skipped) {
            if (!cbLive.value) {
                status.text = "Ao vivo desligado.";
            } else if (!r || (r.ok === 0 && r.failed === 0)) {
                status.text = "Selecione keyframes para ver a curva na timeline.";
            } else {
                status.text =
                    "Ao vivo: " + r.ok + " trecho(s)" +
                    (r.failed ? " | " + r.failed + " falharam" : "") +
                    (skipped ? " | " + skipped + " propriedade(s) não suportada(s)" : "") + ".";
            }
        }

        // Aplicação única (dropdown, campo Bezier): um Undo por mudança.
        function applyOnce(undoName) {
            if (!cbLive.value) {
                liveStatus(null, 0);
                return;
            }

            var found = findSegments();
            if (found.segments.length === 0) {
                liveStatus(null, 0);
                return;
            }

            var r;
            app.beginUndoGroup(undoName);
            try {
                r = applyToSegments(found.segments);
            } finally {
                app.endUndoGroup();
            }

            liveStatus(r, found.skipped);
        }

        // Cada atualização fecha o próprio Undo: nada fica aberto se o mouse
        // for solto fora do painel.
        function applyLive() {
            var r;
            app.beginUndoGroup("Mesmo Tools - Curva (arrastar)");
            try {
                r = applyToSegments(live.segments);
            } finally {
                app.endUndoGroup();
            }
            liveStatus(r, live.skipped);
        }

        // ----- mouse no editor -----

        editor.addEventListener("mousedown", function (ev) {
            var b = edBox();
            var pts = handlePoints(b);
            var d1 = Math.sqrt(Math.pow(ev.clientX - pts[0][0], 2) + Math.pow(ev.clientY - pts[0][1], 2));
            var d2 = Math.sqrt(Math.pow(ev.clientX - pts[1][0], 2) + Math.pow(ev.clientY - pts[1][1], 2));

            drag = Math.min(d1, d2) <= 12 ? (d1 <= d2 ? 1 : 2) : 0;
            if (!drag) return;

            lib.frozenRange = true; // escala do gráfico parada enquanto arrasta

            // Pega as keyframes uma vez, no começo do arraste.
            live.segments = null;

            if (cbLive.value) {
                var found = findSegments();
                if (found.segments.length) {
                    live.segments = found.segments;
                    live.skipped = found.skipped;
                }
            }

            uiRedraw(editor);
        });

        editor.addEventListener("mousemove", function (ev) {
            if (!drag) return;

            var b = edBox();
            var r = yRange();
            var vx = Math.max(0, Math.min(1, edInvX(ev.clientX, b)));
            var vy = Math.max(r[0], Math.min(r[1], edInvY(ev.clientY, b)));

            if (ev.shiftKey) {
                vx = Math.round(vx * 20) / 20;
                vy = Math.round(vy * (lib.mode === "speed" ? 4 : 20)) / (lib.mode === "speed" ? 4 : 20);
            }

            var e = lib.edit;

            if (lib.mode === "speed") {
                // alça = (influência, velocidade), como no Speed Graph do AE
                if (drag === 1) {
                    e.x1 = round3(Math.max(0.01, vx));
                    e.y1 = round3(vy * e.x1);
                } else {
                    e.x2 = round3(Math.min(0.99, vx));
                    e.y2 = round3(1 - vy * (1 - e.x2));
                }
            } else if (drag === 1) {
                e.x1 = round3(vx);
                e.y1 = round3(vy);
            } else {
                e.x2 = round3(vx);
                e.y2 = round3(vy);
            }

            lib.selected = null;
            syncEditorFields();
            uiRedraw(editor);

            if (live.segments && now() - live.last >= LIVE_INTERVAL) {
                live.last = now();
                applyLive();
            }
        });

        function endDrag() {
            if (!drag) return;
            drag = 0;
            lib.frozenRange = false;

            if (live.segments) applyLive(); // posição final exata
            else liveStatus(null, 0);

            live.segments = null;
            uiRedraw(editor);
        }

        editor.addEventListener("mouseup", endDrag);
        tab.addEventListener("mouseup", endDrag);

        // Saiu da área do editor segurando o clique: solta a alça ali mesmo.
        // (Confere a posição: o redesenho do editor também dispara "mouseout",
        // mas com o mouse ainda dentro, e esse caso é ignorado.)
        editor.addEventListener("mouseout", function (ev) {
            if (!drag) return;
            var w = editor.size[0];
            var h = editor.size[1];
            var x = ev.clientX;
            var y = ev.clientY;
            if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) endDrag();
        });

        // ----- biblioteca -----

        function refreshDropdown() {
            lib.busy = true;
            ddCurves.removeAll();
            lib.ddMap = [];

            var pick = -1;
            var i;

            function addItem(c, label) {
                ddCurves.add("item", label);
                lib.ddMap.push(c);
                if (c && c.name === lib.selected) pick = lib.ddMap.length - 1;
            }

            function addSeparator() {
                ddCurves.add("separator");
                lib.ddMap.push(null);
            }

            addItem(null, lib.selected ? "— curva personalizada —" : "— escolha uma curva —");

            var favs = [];
            for (i = 0; i < curves.length; i++) if (curves[i].fav) favs.push(curves[i]);

            if (favs.length) {
                addSeparator();
                for (i = 0; i < favs.length; i++) addItem(favs[i], "★ " + favs[i].name);
            }

            var cats = [];
            var seen = {};
            for (i = 0; i < curves.length; i++) {
                if (!seen["k" + curves[i].cat]) {
                    seen["k" + curves[i].cat] = true;
                    cats.push(curves[i].cat);
                }
            }

            for (var c = 0; c < cats.length; c++) {
                addSeparator();
                for (i = 0; i < curves.length; i++) {
                    if (curves[i].cat === cats[c] && !curves[i].fav) {
                        addItem(curves[i], cats[c] + "  ·  " + curves[i].name);
                    }
                }
            }

            ddCurves.selection = pick === -1 ? 0 : pick;
            lib.busy = false;
        }

        function syncEditorFields() {
            var e = lib.edit;
            txtValues.text = curveValuesText(e);
            var sp = speedsOf(e);
            infoText.text =
                "Saída " + Math.round(e.x1 * 100) + "% · " + (Math.round(sp.s1 * 10) / 10) + "×   " +
                "Entrada " + Math.round((1 - e.x2) * 100) + "% · " + (Math.round(sp.s2 * 10) / 10) + "×";
        }

        function loadIntoEditor(c) {
            lib.selected = c ? c.name : null;
            lib.edit = c
                ? makeCurve(c.name, c.cat, c.x1, c.y1, c.x2, c.y2, c.fav)
                : makeCurve("", txtCat.text || "Minhas", 0.333, 0, 0.667, 1, false);

            if (c) {
                txtName.text = c.name;
                txtCat.text = c.cat;
            }

            syncEditorFields();
            uiRedraw(editor);
        }

        function persist() {
            return writeCurveFile(getCurveStoreFile(), curves);
        }

        ddCurves.onChange = function () {
            if (lib.busy || !ddCurves.selection) return;

            var c = lib.ddMap[ddCurves.selection.index];
            if (!c) return;

            loadIntoEditor(c);
            applyOnce("Mesmo Tools - Curva " + c.name);
        };

        txtValues.onChange = function () {
            var v = parseCurveValues(txtValues.text);

            if (!v) {
                alert("Use 4 números: x1, y1, x2, y2 (ex.: 0.4, 0, 0.2, 1).");
                syncEditorFields();
                return;
            }

            var e = lib.edit;
            lib.edit = makeCurve(e.name, e.cat, v[0], v[1], v[2], v[3], e.fav);
            lib.selected = null;
            syncEditorFields();
            uiRedraw(editor);
            applyOnce("Mesmo Tools - Curva");
        };

        cbLive.onClick = function () {
            saveSetting("curvesLive", cbLive.value ? "1" : "0");
            if (cbLive.value) applyOnce("Mesmo Tools - Curva");
            else liveStatus(null, 0);
        };

        btnSave.onClick = function () {
            var name = trimString(txtName.text);
            var cat = trimString(txtCat.text) || "Minhas";

            if (name === "") {
                alert("Dê um nome para a curva.");
                return;
            }

            var e = lib.edit;
            var idx = findCurveIndex(curves, name);
            var fav = idx !== -1 ? curves[idx].fav : false;
            var c = makeCurve(name, cat, e.x1, e.y1, e.x2, e.y2, fav);

            if (idx === -1) curves.push(c);
            else curves[idx] = c;

            if (persist()) {
                lib.selected = name;
                lib.edit = makeCurve(name, cat, c.x1, c.y1, c.x2, c.y2, fav);
                refreshDropdown();
                status.text = (idx === -1 ? "Curva salva: " : "Curva atualizada: ") + name;
            }
        };

        btnFav.onClick = function () {
            var idx = lib.selected === null ? -1 : findCurveIndex(curves, lib.selected);
            if (idx === -1) {
                alert("Escolha (ou salve) uma curva da biblioteca primeiro.");
                return;
            }

            curves[idx].fav = !curves[idx].fav;
            if (persist()) {
                refreshDropdown();
                status.text = curves[idx].fav ? "Favoritada: " + curves[idx].name : "Desfavoritada: " + curves[idx].name;
            }
        };

        btnDelete.onClick = function () {
            var idx = lib.selected === null ? -1 : findCurveIndex(curves, lib.selected);
            if (idx === -1) {
                alert("Escolha uma curva da biblioteca para excluir.");
                return;
            }

            var name = curves[idx].name;
            if (!confirm("Excluir a curva \"" + name + "\"?")) return;

            curves.splice(idx, 1);
            if (persist()) {
                lib.selected = null;
                refreshDropdown();
                status.text = "Curva excluída: " + name;
            }
        };

        refreshDropdown();
        loadIntoEditor(null);
        setMode(lib.mode);

    }

    // ================================================================
    // CAMADAS — criar camadas, null no atributo, anchor point, extract
    // e marcadores nas batidas do áudio.
    // ================================================================

    function activeCompOrAlert() {
        var comp = app.project ? app.project.activeItem : null;
        if (!isComp(comp)) {
            alert("Abra uma composição primeiro.");
            return null;
        }
        return comp;
    }

    function layerNameExists(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === name) return true;
        }
        return false;
    }

    // "Null", "Null 2", "Null 3"...
    function uniqueLayerName(comp, base) {
        var name = base;
        var n = 2;
        while (layerNameExists(comp, name)) {
            name = base + " " + n;
            n++;
        }
        return name;
    }

    function selectOnly(comp, layers) {
        try {
            var sel = comp.selectedLayers;
            for (var i = 0; i < sel.length; i++) sel[i].selected = false;
            for (i = 0; i < layers.length; i++) layers[i].selected = true;
        } catch (e) {}
    }

    function colorFromInt(c) {
        return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
    }

    function colorToInt(rgb) {
        return (Math.round(rgb[0] * 255) << 16) | (Math.round(rgb[1] * 255) << 8) | Math.round(rgb[2] * 255);
    }

    // ---------- criar camadas ----------

    function createLayerOfKind(kind) {
        var comp = activeCompOrAlert();
        if (!comp) return null;

        var sel = comp.selectedLayers;
        var ref = sel.length ? sel[0] : null;
        var w = comp.width;
        var h = comp.height;
        var center = [w / 2, h / 2];
        var layer = null;

        var solidColor = null;
        if (kind === "solid") {
            var last = parseInt(loadSetting("lastSolidColor", String(colorToInt([0.73, 0.60, 0.98]))), 10);
            var picked = -1;
            try { picked = $.colorPicker(last); } catch (eCp) { picked = last; }
            if (picked < 0) return null; // cancelou
            saveSetting("lastSolidColor", picked);
            solidColor = colorFromInt(picked);
        }

        app.beginUndoGroup("Mesmo Tools - Criar camada");

        try {
            if (kind === "text") {
                layer = comp.layers.addText("Texto");
                layer.name = uniqueLayerName(comp, "Texto");
            } else if (kind === "adjustment") {
                layer = comp.layers.addSolid([1, 1, 1], uniqueLayerName(comp, "Adjustment Layer"),
                    w, h, comp.pixelAspect, comp.duration);
                layer.adjustmentLayer = true;
            } else if (kind === "nullLayer") {
                layer = comp.layers.addNull(comp.duration);
                layer.name = uniqueLayerName(comp, "Null");
            } else if (kind === "solid") {
                layer = comp.layers.addSolid(solidColor, uniqueLayerName(comp, "Sólido"),
                    w, h, comp.pixelAspect, comp.duration);
            } else if (kind === "shape") {
                layer = comp.layers.addShape();
                layer.name = uniqueLayerName(comp, "Shape");
            } else if (kind === "camera") {
                layer = comp.layers.addCamera(uniqueLayerName(comp, "Câmera"), center);
            } else if (kind === "light") {
                layer = comp.layers.addLight(uniqueLayerName(comp, "Luz"), center);
                try { layer.lightType = LightType.POINT; } catch (eLt) {}
            }

            // Como o After: a camada nova entra logo acima da selecionada.
            if (layer && ref) {
                try { layer.moveBefore(ref); } catch (eMv) {}
            }
            if (layer) selectOnly(comp, [layer]);
        } finally {
            app.endUndoGroup();
        }

        return layer;
    }

    // ---------- null na position ----------

    function exprLayerRef(name) {
        return "thisComp.layer(\"" + String(name).replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\")";
    }

    function arrayLiteral(v) {
        var parts = [];
        for (var i = 0; i < v.length; i++) parts.push(String(v[i]));
        return "[" + parts.join(", ") + "]";
    }

    // Converte o valor da Position (espaço do parent) para a comp no tempo t,
    // usando o próprio After (expressão temporária no null). Devolve [x, y, z].
    function worldPositionAt(nullLayer, srcLayer, value, t) {
        var pos = nullLayer.property("ADBE Transform Group").property("ADBE Position");
        var v = arrayLiteral(value);

        pos.expression =
            "var L = thisComp.layer(" + srcLayer.index + ");" +
            " var r = L.hasParent ? L.parent.toComp(" + v + ") : " + v + ";" +
            (nullLayer.threeDLayer ? " [r[0], r[1], (r.length > 2 ? r[2] : 0)]" : " [r[0], r[1]]");

        var out = pos.valueAtTime(t, false);
        pos.expression = "";
        return [out[0], out[1], out.length > 2 ? out[2] : 0];
    }

    // Position combinada + as partes X/Y/Z quando as dimensões estão separadas.
    function positionPropsOf(layer) {
        var tg = layer.property("ADBE Transform Group");
        var pos = tg.property("ADBE Position");
        var parts = null;

        if (pos.dimensionsSeparated) {
            parts = [tg.property("ADBE Position_0"), tg.property("ADBE Position_1")];
            if (layer.threeDLayer) parts.push(tg.property("ADBE Position_2"));
        }

        return {combined: pos, parts: parts};
    }

    // Camadas selecionadas + donas de uma Position selecionada na timeline.
    function layersForNull(comp) {
        var out = [];
        var i;

        function add(l) {
            for (var k = 0; k < out.length; k++) if (out[k] === l) return;
            out.push(l);
        }

        var ls = comp.selectedLayers;
        for (i = 0; i < ls.length; i++) add(ls[i]);

        var props = selectedPropertiesOf(comp);
        for (i = 0; i < props.length; i++) {
            try {
                if (String(props[i].matchName).indexOf("ADBE Position") === 0) {
                    add(props[i].propertyGroup(props[i].propertyDepth));
                }
            } catch (e) {}
        }

        // só camadas que têm Position
        var valid = [];
        for (i = 0; i < out.length; i++) {
            try {
                if (out[i].property("ADBE Transform Group").property("ADBE Position")) valid.push(out[i]);
            } catch (e2) {}
        }
        return valid;
    }

    /*
        Cria UM null para todas as camadas.
        - 1 camada com keyframes na Position: a animação passa para o null e a
          Position segue o null exatamente.
        - Demais casos: o null nasce no centro das camadas; cada Position mantém
          a própria animação e soma o quanto o null se mexer.
    */
    function createPositionNull(comp, layers) {
        var t = comp.time;
        var any3D = false;
        var top = layers[0];
        var i;

        for (i = 0; i < layers.length; i++) {
            if (layers[i].threeDLayer) any3D = true;
            if (layers[i].index < top.index) top = layers[i];
        }

        var baseName = layers.length === 1
            ? layers[0].name
            : layers[0].name + "+" + (layers.length - 1);

        var nul = comp.layers.addNull(comp.duration);
        nul.name = uniqueLayerName(comp, baseName + "-position-null");
        if (any3D) nul.threeDLayer = true;
        try { nul.label = 9; } catch (eLb) {}
        try { nul.moveBefore(top); } catch (eMv) {}

        var npos = nul.property("ADBE Transform Group").property("ADBE Position");
        var ref = exprLayerRef(nul.name);
        var first = positionPropsOf(layers[0]);
        var k;

        // 1 camada animada: leva os keyframes para o null
        if (layers.length === 1 && !first.parts && first.combined.numKeys > 0) {
            var p = first.combined;
            var times = [];
            var values = [];

            for (k = 1; k <= p.numKeys; k++) {
                var w = worldPositionAt(nul, layers[0], p.keyValue(k), p.keyTime(k));
                times.push(p.keyTime(k));
                values.push(any3D ? w : [w[0], w[1]]);
            }

            npos.setValuesAtTimes(times, values);

            for (k = 1; k <= p.numKeys; k++) {
                try {
                    npos.setInterpolationTypeAtKey(k, p.keyInInterpolationType(k), p.keyOutInterpolationType(k));
                    npos.setTemporalEaseAtKey(k, p.keyInTemporalEase(k), p.keyOutTemporalEase(k));
                } catch (eEase) {}
            }

            p.expression =
                "// Segue o null " + nul.name + " (Mesmo Tools)\n" +
                "var n = " + ref + ";\n" +
                "var p = n.toComp(n.anchorPoint);\n" +
                "var r = hasParent ? parent.fromComp(p) : p;\n" +
                (p.value.length > 2 ? "r;" : "[r[0], r[1]];");

            return nul;
        }

        // null no centro das posições atuais
        var sum = [0, 0, 0];
        for (i = 0; i < layers.length; i++) {
            var wp = worldPositionAt(nul, layers[i], positionPropsOf(layers[i]).combined.valueAtTime(t, false), t);
            sum[0] += wp[0];
            sum[1] += wp[1];
            sum[2] += wp[2];
        }

        var c = [sum[0] / layers.length, sum[1] / layers.length, sum[2] / layers.length];
        npos.setValue(any3D ? c : [c[0], c[1]]);

        var head =
            "// Segue o null " + nul.name + " (Mesmo Tools)\n" +
            "var n = " + ref + ";\n" +
            "var q = n.toComp(n.anchorPoint);\n" +
            "var d = [q[0] - " + c[0] + ", q[1] - " + c[1] + ", (q.length > 2 ? q[2] : 0) - " + (any3D ? c[2] : 0) + "];\n" +
            "var v = hasParent ? parent.fromCompVec(d) : d;\n";

        for (i = 0; i < layers.length; i++) {
            var pp = positionPropsOf(layers[i]);

            if (pp.parts) {
                for (k = 0; k < pp.parts.length; k++) {
                    pp.parts[k].expression = head + "value + v[" + k + "];";
                }
            } else {
                pp.combined.expression = head +
                    (pp.combined.value.length > 2 ? "value + [v[0], v[1], v[2]];" : "value + [v[0], v[1]];");
            }
        }

        return nul;
    }

    // Propriedades selecionadas na comp ativa (sem repetir).
    function selectedPropertiesOf(comp) {
        var out = [];

        function add(p) {
            for (var i = 0; i < out.length; i++) if (out[i] === p) return;
            out.push(p);
        }

        try {
            var cp = comp.selectedProperties;
            for (var i = 0; i < cp.length; i++) add(cp[i]);
        } catch (e1) {}

        try {
            var ls = comp.selectedLayers;
            for (var j = 0; j < ls.length; j++) {
                var lp = ls[j].selectedProperties;
                for (var k = 0; k < lp.length; k++) add(lp[k]);
            }
        } catch (e2) {}

        return out;
    }

    // ---------- anchor point ----------

    function offsetScalarProperty(prop, delta) {
        try {
            if (prop.numKeys > 0) {
                for (var i = 1; i <= prop.numKeys; i++) prop.setValueAtKey(i, prop.keyValue(i) + delta);
            } else {
                prop.setValue(prop.value + delta);
            }
        } catch (e) {}
    }

    /*
        Move o anchor para um ponto do retângulo da camada (fx, fy de 0 a 1)
        sem mexer onde a camada aparece: a Position é compensada usando a
        escala e a rotação no tempo atual.
    */
    function setAnchorToRect(layer, fx, fy, t) {
        if (layer instanceof CameraLayer || layer instanceof LightLayer) return false;

        var r;
        try { r = layer.sourceRectAtTime(t, false); } catch (eR) { return false; }
        if (!r) return false;

        var tg = layer.property("ADBE Transform Group");
        var ap = tg.property("ADBE Anchor Point");
        var cur = ap.valueAtTime(t, false);
        var d = [r.left + r.width * fx - cur[0], r.top + r.height * fy - cur[1]];

        if (Math.abs(d[0]) < 1e-4 && Math.abs(d[1]) < 1e-4) return true;

        var sc = tg.property("ADBE Scale").valueAtTime(t, false);
        var rot = 0;
        try { rot = tg.property("ADBE Rotate Z").valueAtTime(t, false); } catch (eRot) {}

        var sx = d[0] * sc[0] / 100;
        var sy = d[1] * sc[1] / 100;
        var a = rot * Math.PI / 180;
        var pd = [sx * Math.cos(a) - sy * Math.sin(a), sx * Math.sin(a) + sy * Math.cos(a)];

        offsetArrayProperty(ap, [d[0], d[1], 0]);

        var pos = tg.property("ADBE Position");
        if (pos.dimensionsSeparated) {
            offsetScalarProperty(tg.property("ADBE Position_0"), pd[0]);
            offsetScalarProperty(tg.property("ADBE Position_1"), pd[1]);
        } else {
            offsetArrayProperty(pos, [pd[0], pd[1], 0]);
        }

        return true;
    }

    // ---------- extract ----------

    function extractShapeGroups(layer, deleteOriginal, centerAnchor) {
        if (!(layer instanceof ShapeLayer)) return {pieces: 0, reason: "não é shape layer"};

        var comp = layer.containingComp;
        var contents = layer.property("ADBE Root Vectors Group");
        var groups = [];
        var i;

        for (i = 1; i <= contents.numProperties; i++) {
            if (contents.property(i).matchName === "ADBE Vector Group") {
                groups.push({index: i, name: contents.property(i).name});
            }
        }

        if (groups.length < 2) return {pieces: 0, reason: "tem menos de 2 grupos"};

        var created = [];

        // Cada cópia nasce logo acima da original: a ordem final fica igual à dos grupos.
        for (var g = 0; g < groups.length; g++) {
            var dup = layer.duplicate();
            var c = dup.property("ADBE Root Vectors Group");

            // remove os OUTROS grupos; fills/strokes soltos no topo continuam valendo
            for (var k = c.numProperties; k >= 1; k--) {
                if (k !== groups[g].index && c.property(k).matchName === "ADBE Vector Group") {
                    c.property(k).remove();
                }
            }

            dup.name = uniqueLayerName(comp, layer.name + " - " + groups[g].name);
            dup.enabled = true;

            if (centerAnchor) setAnchorToRect(dup, 0.5, 0.5, comp.time);

            created.push(dup);
        }

        if (deleteOriginal) layer.remove();
        else layer.enabled = false;

        selectOnly(comp, created);
        return {pieces: created.length, reason: null};
    }

    // ---------- batidas ----------

    function findAmplitudeSlider(ampLayer) {
        var fx = ampLayer.property("ADBE Effect Parade");
        var names = ["Both Channels", "Ambos os canais"];
        for (var i = 0; i < names.length; i++) {
            var e = fx.property(names[i]);
            if (e) return e.property(1);
        }
        // fallback: primeiro slider do layer
        if (fx.numProperties > 0) return fx.property(1).property(1);
        return null;
    }

    /*
        Detecta onsets: picos locais que passam da média ao redor (k vezes)
        e de um piso de 12% do máximo, respeitando um intervalo mínimo.
        values: amplitude por frame. Devolve índices dos frames com batida.
    */
    function detectBeatFrames(values, fps, sensitivity, minGapFrames) {
        var n = values.length;
        var out = [];
        if (n < 3) return out;

        var vmax = 0;
        var i;
        for (i = 0; i < n; i++) if (values[i] > vmax) vmax = values[i];
        if (vmax <= 0) return out;

        var k = 2.0 - (Math.max(1, Math.min(10, sensitivity)) - 1) * 0.1; // 1 → 2.0 ... 10 → 1.1
        var floor = vmax * 0.12;
        var win = Math.max(2, Math.round(fps * 0.4));
        var last = -1e9;

        for (i = 0; i < n; i++) {
            var v = values[i];
            var prev = i > 0 ? values[i - 1] : -1;
            var next = i < n - 1 ? values[i + 1] : -1;

            if (v < floor) continue;
            if (!(v >= prev && v > next)) continue; // pico local

            var a = Math.max(0, i - win);
            var b = Math.min(n - 1, i + win);
            var sum = 0;
            for (var j = a; j <= b; j++) sum += values[j];
            var mean = sum / (b - a + 1);

            if (v >= mean * k && i - last >= minGapFrames) {
                out.push(i);
                last = i;
            }
        }

        return out;
    }

    function markBeats(layer, opts) {
        var comp = layer.containingComp;
        var keepSel = comp.selectedLayers;

        selectOnly(comp, [layer]);
        try { comp.openInViewer(); } catch (eV) {}

        var cmd = 0;
        try { cmd = app.findMenuCommandId("Convert Audio to Keyframes"); } catch (eC) {}
        if (!cmd) {
            try { cmd = app.findMenuCommandId("Converter áudio em quadros-chave"); } catch (eC2) {}
        }
        if (!cmd) throw new Error("Não achei o comando \"Convert Audio to Keyframes\" do After.");

        var before = comp.numLayers;
        app.executeCommand(cmd);

        if (comp.numLayers <= before) throw new Error("O After não criou a camada Audio Amplitude.");

        var amp = comp.layer(1);
        var slider = findAmplitudeSlider(amp);
        var values = [];
        var times = [];

        if (slider) {
            for (var k = 1; k <= slider.numKeys; k++) {
                values.push(slider.keyValue(k));
                times.push(slider.keyTime(k));
            }
        }

        // limpa a camada temporária e o sólido dela
        var src = null;
        try { src = amp.source; } catch (eS) {}
        amp.remove();
        try { if (src && src.usedIn.length === 0) src.remove(); } catch (eSr) {}

        selectOnly(comp, keepSel);

        var frames = detectBeatFrames(values, comp.frameRate, opts.sensitivity, opts.minGap);
        var markers = layer.property("ADBE Marker");

        if (opts.clear) {
            while (markers.numKeys > 0) markers.removeKey(1);
        }

        for (var f = 0; f < frames.length; f++) {
            var mv = new MarkerValue(opts.numbered ? String(f + 1) : "");
            markers.setValueAtTime(times[frames[f]], mv);
        }

        return frames.length;
    }

    // ---------- abas ----------

    function buildCreateTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 6;
        tab.margins = [0, 6, 0, 0];

        var KINDS = [
            [{k: "text", label: "Texto"}, {k: "adjustment", label: "Adjust."}, {k: "nullLayer", label: "Null"}, {k: "solid", label: "Sólido"}],
            [{k: "shape", label: "Shape"}, {k: "camera", label: "Câmera"}, {k: "light", label: "Luz"}]
        ];
        var TIPS = {
            text: "Camada de texto",
            adjustment: "Adjustment Layer do tamanho da comp",
            nullLayer: "Null Object",
            solid: "Sólido do tamanho da comp (escolha a cor)",
            shape: "Shape Layer vazia",
            camera: "Câmera centralizada",
            light: "Luz (Point) centralizada"
        };

        var status;

        for (var r = 0; r < KINDS.length; r++) {
            var row = tab.add("group");
            row.orientation = "row";
            row.alignChildren = ["fill", "center"];
            row.spacing = 4;

            for (var c = 0; c < 4; c++) {
                var item = KINDS[r][c];
                if (!item) {
                    // espaço vazio para manter a grade
                    var spacer = row.add("group");
                    spacer.preferredSize = [30, 26];
                    spacer.alignment = ["fill", "center"];
                    continue;
                }

                var b = uiButton(row, item.label, {height: 26, tip: TIPS[item.k]});
                uiFlex(b, 30);
                b.mesmoKind = item.k;
                b.onClick = function () {
                    var layer = createLayerOfKind(this.mesmoKind);
                    if (layer) status.text = "Criada: " + layer.name;
                };
            }
        }

        var btnNull = uiButton(tab, "NULL NA POSITION", {
            primary: true,
            tip: "Selecione uma ou mais camadas: cria um null no ponto delas e linka a Position ao null. Várias camadas = um único null que move todas."
        });

        status = addStatus(tab, "Clique para criar na comp aberta.");

        btnNull.onClick = function () {
            var comp = activeCompOrAlert();
            if (!comp) return;

            var layers = layersForNull(comp);
            if (layers.length === 0) {
                alert("Selecione uma ou mais camadas.");
                return;
            }

            var nul = null;
            app.beginUndoGroup("Mesmo Tools - Null na position");
            try {
                nul = createPositionNull(comp, layers);
                selectOnly(comp, [nul]);
            } catch (e) {
                alert("Não foi possível criar o null:\n" + e.toString().replace("Error: ", ""));
            } finally {
                app.endUndoGroup();
            }

            if (nul) {
                status.text = "Null criado: " + nul.name +
                    (layers.length > 1 ? " (" + layers.length + " camadas)" : "");
            }
        };
    }

    function buildAnchorTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 6;
        tab.margins = [0, 6, 0, 0];

        var CELL = 28;
        var NAMES = [
            ["Topo esquerdo", "Topo", "Topo direito"],
            ["Esquerda", "Centro", "Direita"],
            ["Base esquerda", "Base", "Base direita"]
        ];

        var row0 = tab.add("group");
        row0.orientation = "row";
        row0.alignChildren = ["left", "top"];
        row0.spacing = 10;

        var gridBox = row0.add("group");
        gridBox.orientation = "column";
        gridBox.alignChildren = ["left", "top"];
        gridBox.spacing = 3;

        var status;

        // Célula: quadrado lilás com a marquinha do ponto (quina, borda ou centro).
        function drawCell(state) {
            var g = this.graphics;
            var w = this.size[0];
            var h = this.size[1];
            var fx = this.mesmoFx;
            var fy = this.mesmoFy;
            var fill = state.leftButtonPressed ? THEME.accentDown : (state.mouseOver ? THEME.accentHover : THEME.accent);
            var mark = [1, 1, 1, 0.85];
            var m = 4;   // margem da marca
            var L = 8;   // tamanho da perna do "L"
            var s = 3;   // espessura

            uiRoundRect(g, 0, 0, w, h, 3);
            g.fillPath(uiBrush(g, fill));

            var brush = uiBrush(g, mark);

            if (fx === 0.5 && fy === 0.5) {
                g.newPath();
                g.rectPath(w / 2 - 6, h / 2 - 6, 12, 12);
                g.strokePath(uiPen(g, mark, 2.5));
                return;
            }

            var x = fx === 0 ? m : (fx === 1 ? w - m : w / 2);
            var y = fy === 0 ? m : (fy === 1 ? h - m : h / 2);

            g.newPath();
            if (fx !== 0.5 && fy !== 0.5) {
                // quina: L apontando para o canto
                var dx = fx === 0 ? 1 : -1;
                var dy = fy === 0 ? 1 : -1;
                g.rectPath(Math.min(x, x + dx * L), Math.min(y, y + dy * s), L, s);
                g.rectPath(Math.min(x, x + dx * s), Math.min(y, y + dy * L), s, L);
            } else if (fx === 0.5) {
                // borda de cima/baixo: barra horizontal
                g.rectPath(w / 2 - L / 2 - 2, fy === 0 ? m : h - m - s, L + 4, s);
            } else {
                // borda esquerda/direita: barra vertical
                g.rectPath(fx === 0 ? m : w - m - s, h / 2 - L / 2 - 2, s, L + 4);
            }
            g.fillPath(brush);
        }

        function onCell() {
            var comp = activeCompOrAlert();
            if (!comp) return;

            var layers = comp.selectedLayers;
            if (layers.length === 0) {
                alert("Selecione uma ou mais camadas.");
                return;
            }

            var ok = 0;
            app.beginUndoGroup("Mesmo Tools - Anchor Point");
            try {
                for (var i = 0; i < layers.length; i++) {
                    try { if (setAnchorToRect(layers[i], this.mesmoFx, this.mesmoFy, comp.time)) ok++; } catch (e) {}
                }
            } finally {
                app.endUndoGroup();
            }

            status.text = "Anchor em \"" + this.mesmoName + "\" em " + ok + " camada(s).";
        }

        for (var r = 0; r < 3; r++) {
            var row = gridBox.add("group");
            row.orientation = "row";
            row.spacing = 3;

            for (var c = 0; c < 3; c++) {
                var cell = row.add("button", undefined, "");
                cell.preferredSize = [CELL, CELL];
                cell.mesmoFx = c / 2;
                cell.mesmoFy = r / 2;
                cell.mesmoName = NAMES[r][c];
                cell.helpTip = "Anchor Point: " + NAMES[r][c];
                cell.onDraw = drawCell;
                cell.onClick = onCell;
            }
        }

        var help = uiFlex(row0.add("statictext", undefined,
            "Move o Anchor Point para a quina, borda ou centro da camada sem tirá-la do lugar.",
            {multiline: true}), 60);
        help.alignment = ["fill", "fill"];
        uiColorText(help, THEME.textDim);

        status = addStatus(tab, "Selecione camadas e clique num ponto.");
    }

    function buildExtractTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 6;
        tab.margins = [0, 6, 0, 0];

        var info = uiFlex(uiLabel(tab, "Separa cada grupo da shape layer em uma camada."), 60);
        info.helpTip = "Cada grupo do Contents vira uma camada própria, na mesma posição.";

        var cbCenter = uiFlex(tab.add("checkbox", undefined, "Centralizar o anchor de cada peça"));
        cbCenter.value = loadSetting("extractCenter", "1") === "1";

        var cbDelete = uiFlex(tab.add("checkbox", undefined, "Apagar a original (senão só esconde)"));
        cbDelete.value = loadSetting("extractDelete", "0") === "1";

        var btn = uiButton(tab, "EXTRAIR FORMAS", {primary: true});
        var status = addStatus(tab, "Selecione shape layers com 2 ou mais grupos.");

        btn.onClick = function () {
            var comp = activeCompOrAlert();
            if (!comp) return;

            var layers = comp.selectedLayers;
            if (layers.length === 0) {
                alert("Selecione uma ou mais shape layers.");
                return;
            }

            saveSetting("extractCenter", cbCenter.value ? "1" : "0");
            saveSetting("extractDelete", cbDelete.value ? "1" : "0");

            var total = 0;
            var skipped = [];

            app.beginUndoGroup("Mesmo Tools - Extract");
            try {
                // copia a lista: a seleção muda durante o processo
                var list = [];
                for (var i = 0; i < layers.length; i++) list.push(layers[i]);

                for (i = 0; i < list.length; i++) {
                    var name = list[i].name;
                    try {
                        var res = extractShapeGroups(list[i], cbDelete.value, cbCenter.value);
                        if (res.pieces) total += res.pieces;
                        else skipped.push(name + " (" + res.reason + ")");
                    } catch (e) {
                        skipped.push(name + " (" + e.toString().replace("Error: ", "") + ")");
                    }
                }
            } finally {
                app.endUndoGroup();
            }

            status.text = total + " camada(s) criada(s)" + (skipped.length ? " | " + skipped.length + " ignorada(s)" : "") + ".";
            if (skipped.length && total === 0) alert("Nada para extrair:\n\n" + skipped.join("\n"));
        };
    }

    function buildBeatsTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 6;
        tab.margins = [0, 6, 0, 0];

        var sensRow = tab.add("group");
        sensRow.orientation = "row";
        sensRow.alignChildren = ["fill", "center"];

        uiLabel(sensRow, "Sensibilidade:");
        var sens = sensRow.add("slider", undefined, parseFloat(loadSetting("beatSens", "5")), 1, 10);
        sens.alignment = ["fill", "center"];
        sens.preferredSize.width = 60;
        sens.helpTip = "Mais alto = mais batidas (pega as mais fracas também)";
        var sensVal = uiLabel(sensRow, "");
        sensVal.preferredSize.width = 22;

        var gapRow = tab.add("group");
        gapRow.orientation = "row";
        gapRow.alignChildren = ["left", "center"];

        uiLabel(gapRow, "Intervalo mínimo:");
        var txtGap = gapRow.add("edittext", undefined, loadSetting("beatGap", "6"));
        txtGap.characters = 4;
        uiLabel(gapRow, "frames");

        var cbClear = uiFlex(tab.add("checkbox", undefined, "Apagar os marcadores antigos da camada"));
        cbClear.value = loadSetting("beatClear", "1") === "1";

        var cbNumber = uiFlex(tab.add("checkbox", undefined, "Numerar os marcadores (1, 2, 3...)"));
        cbNumber.value = loadSetting("beatNumber", "0") === "1";

        var btn = uiButton(tab, "MARCAR BATIDAS", {primary: true});
        var status = addStatus(tab, "Selecione uma camada com áudio.");

        function syncSens() {
            sens.value = Math.round(sens.value);
            sensVal.text = String(sens.value);
        }

        sens.onChanging = syncSens;
        syncSens();

        btn.onClick = function () {
            var comp = activeCompOrAlert();
            if (!comp) return;

            var layers = comp.selectedLayers;
            if (layers.length !== 1) {
                alert("Selecione uma camada de áudio (só uma).");
                return;
            }

            var layer = layers[0];
            var hasAudio = false;
            try { hasAudio = layer.hasAudio; } catch (eA) {}
            if (!hasAudio) {
                alert("A camada \"" + layer.name + "\" não tem áudio.");
                return;
            }

            var gap = parseInt(txtGap.text, 10);
            if (isNaN(gap) || gap < 1) gap = 1;

            saveSetting("beatSens", sens.value);
            saveSetting("beatGap", gap);
            saveSetting("beatClear", cbClear.value ? "1" : "0");
            saveSetting("beatNumber", cbNumber.value ? "1" : "0");

            status.text = "Analisando o áudio...";

            var count = 0;
            app.beginUndoGroup("Mesmo Tools - Marcar batidas");
            try {
                count = markBeats(layer, {
                    sensitivity: sens.value,
                    minGap: gap,
                    clear: cbClear.value,
                    numbered: cbNumber.value
                });
            } catch (e) {
                status.text = "Não foi possível analisar.";
                alert(e.toString().replace("Error: ", ""));
                return;
            } finally {
                app.endUndoGroup();
            }

            status.text = count + " batida(s) marcada(s) em \"" + layer.name + "\".";
        };
    }

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME, undefined, {resizeable: true});

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = [10, 8, 10, 10];

        uiHeader(win);

        // Abas principais. Cada aba mostra TODAS as suas ferramentas ao mesmo
        // tempo: lado a lado quando o painel é largo, empilhadas quando é estreito.
        var GROUPS = [
            {
                label: "Animação", abbr: "Anim", tip: "Curvas de velocidade + Explode de texto",
                tools: [
                    {label: "Curvas", build: buildCurvesTab, width: 330},
                    {label: "Explode", build: buildExplodeTab, width: 290}
                ]
            },
            {
                label: "Camadas", abbr: "Lyr", tip: "Criar camadas, null no atributo, anchor point, extract e batidas",
                tools: [
                    {label: "Criar", build: buildCreateTab, width: 260},
                    {label: "Anchor Point", build: buildAnchorTab, width: 240},
                    {label: "Extract", build: buildExtractTab, width: 250},
                    {label: "Batidas", build: buildBeatsTab, width: 260}
                ]
            },
            {
                label: "Comps", abbr: "Comp", tip: "Ajustes de comp + Duplicar + 3D / Motion Blur",
                tools: [
                    {label: "Ajustes", build: buildCompsTab, width: 300},
                    {label: "Duplicar", build: buildDuplicaTab, width: 300},
                    {label: "3D / Blur", build: build3DTab, width: 270}
                ]
            },
            {
                label: "Expressões", abbr: "Expr", tip: "Atalhos de expressões e suas favoritas",
                tools: [
                    {label: "Expressões", build: buildExpressionsTab, width: 360, noHeader: true}
                ]
            }
        ];

        var BIG = 10000;
        var groupViews = [];

        function setCollapsed(body, collapsed) {
            body.visible = !collapsed;
            // ScriptUI reserva espaço para itens escondidos: zera o tamanho máximo.
            body.maximumSize = collapsed ? [BIG, 0] : [BIG, BIG];
        }

        function buildGroup(page, group, gIndex) {
            page.orientation = "column";
            page.alignChildren = ["fill", "top"];
            page.margins = [0, 4, 0, 0];

            var row = page.add("group");
            row.orientation = "row";
            row.alignment = ["fill", "fill"];
            row.alignChildren = ["fill", "top"];
            row.spacing = 12;

            var view = {row: row, tools: [], hooks: [], minWide: 0, pendingCollapse: []};

            function makeToggle(h, b, k) {
                return function () {
                    h.mesmoOpen = !h.mesmoOpen;
                    uiRedraw(h);
                    setCollapsed(b, !h.mesmoOpen);
                    saveSetting(k, h.mesmoOpen ? "1" : "0");
                    relayout();
                };
            }

            for (var t = 0; t < group.tools.length; t++) {
                var tool = group.tools[t];
                var key = "open_" + gIndex + "_" + t;

                var block = row.add("group");
                block.orientation = "column";
                block.alignment = ["fill", "top"];
                block.alignChildren = ["fill", "top"];
                block.spacing = 4;
                block.mesmoWidth = tool.width;

                var header = tool.noHeader ? null : uiToolHeader(block, tool.label);

                var body = block.add("group");
                body.alignment = ["fill", "top"];

                if (header) {
                    header.onClick = makeToggle(header, body, key);

                    if (loadSetting(key, "1") === "0") {
                        header.mesmoOpen = false;
                        view.pendingCollapse.push(body);
                    }
                }

                view.hooks.push(tool.build(body) || null);
                view.tools.push(block);
                view.minWide += tool.width + 12;
            }

            view.refresh = function () {
                for (var i = 0; i < view.hooks.length; i++) {
                    try { if (view.hooks[i] && view.hooks[i].refresh) view.hooks[i].refresh(); } catch (e) {}
                }
            };

            return view;
        }

        var layoutMode = loadSetting("layoutMode", "auto"); // auto | wide | stacked

        // Escolhe lado a lado ou empilhado conforme a largura do painel.
        function applyResponsive() {
            var w = 0;
            try { w = win.size[0]; } catch (e) {}
            var changed = false;

            for (var i = 0; i < groupViews.length; i++) {
                var v = groupViews[i];
                var wide = layoutMode === "wide" || (layoutMode === "auto" && w >= v.minWide);
                var want = wide ? "row" : "column";

                if (v.row.orientation !== want) {
                    v.row.orientation = want;
                    changed = true;
                }

                // Lado a lado: cada coluna com sua largura. Empilhado: ocupa tudo.
                for (var t = 0; t < v.tools.length; t++) {
                    try {
                        v.tools[t].preferredSize.width = wide ? v.tools[t].mesmoWidth : -1;
                    } catch (eW) {}
                }
            }

            return changed;
        }

        var relaying = false;

        // Recalcular a janela inteira é lento (centenas de controles, todas
        // as abas). Aqui só a aba ativa é recalculada e encaixada na área.
        function fitActivePage() {
            var p = pages[activeGroup];
            p.layout.layout(true);

            var w = viewport.size[0];
            var h = p.preferredSize[1];

            stack.preferredSize = [-1, h];
            content.preferredSize = [-1, h + 6];

            content.size = [w, h + 6];
            stack.size = [w, h];
            p.size = [w, h];
            p.layout.resize();
        }

        function relayout() {
            if (relaying) return;
            relaying = true;
            try {
                applyResponsive();
                fitActivePage();
            } catch (e) {
                // plano B: recalcula tudo
                try {
                    win.layout.layout(true);
                    win.layout.resize();
                } catch (e2) {}
            }
            updateScroll();
            relaying = false;
        }

        var topRow = win.add("group");
        topRow.orientation = "row";
        topRow.alignment = ["fill", "top"];
        topRow.alignChildren = ["fill", "fill"];
        topRow.spacing = 6;

        var stack;
        var pages = [];

        var nav = uiNav(topRow, GROUPS, function (idx) {
            for (var i = 0; i < pages.length; i++) pages[i].visible = (i === idx);
            saveSetting("lastGroup", idx);
            try { groupViews[idx].refresh(); } catch (e) {}

            // cada aba começa do topo, já encaixada
            activeGroup = idx;
            try { scrollbar.value = 0; } catch (eS) {}
            if (started) relayout();
            else updateScroll();
        });

        var LAYOUT_LABELS = {auto: "Auto", wide: "Lado a lado", stacked: "Empilhado"};
        var btnLayout = uiButton(topRow, "⇆", {width: 28, height: 28});
        btnLayout.alignment = ["right", "fill"];
        btnLayout.helpTip = "Disposição das ferramentas: " + LAYOUT_LABELS[layoutMode] +
            "\n(clique para alternar: Auto → Lado a lado → Empilhado)";

        btnLayout.onClick = function () {
            layoutMode = layoutMode === "auto" ? "wide" : (layoutMode === "wide" ? "stacked" : "auto");
            saveSetting("layoutMode", layoutMode);
            btnLayout.helpTip = "Disposição das ferramentas: " + LAYOUT_LABELS[layoutMode] +
                "\n(clique para alternar: Auto → Lado a lado → Empilhado)";
            relayout();
        };

        // ----- área com rolagem -----
        // viewport: janela visível (tamanho do painel); content: tudo, mais alto
        // que o viewport quando o painel é pequeno; scrollbar move o content.
        var scrollRow = win.add("group");
        scrollRow.orientation = "row";
        scrollRow.alignment = ["fill", "fill"];
        scrollRow.alignChildren = ["fill", "fill"];
        scrollRow.spacing = 4;
        scrollRow.margins = 0;

        var viewport = scrollRow.add("group");
        viewport.orientation = "column";
        viewport.alignment = ["fill", "fill"];
        viewport.alignChildren = ["fill", "top"];
        viewport.margins = 0;
        viewport.preferredSize = [260, 160]; // não deixa o conteúdo ditar o tamanho do painel

        var content = viewport.add("group");
        content.orientation = "column";
        content.alignment = ["fill", "top"];
        content.alignChildren = ["fill", "top"];
        content.margins = [0, 0, 0, 6];

        var scrollbar = scrollRow.add("scrollbar", undefined, 0, 0, 100);
        scrollbar.alignment = ["right", "fill"];
        scrollbar.preferredSize.width = 14;
        scrollbar.stepdelta = 30;

        stack = content.add("group");
        stack.orientation = "stack";
        stack.alignment = ["fill", "top"];
        stack.alignChildren = ["fill", "top"];

        for (var i = 0; i < GROUPS.length; i++) {
            var page = stack.add("group");
            page.alignment = ["fill", "fill"];
            groupViews.push(buildGroup(page, GROUPS[i], i));
            page.visible = false;
            pages.push(page);
        }

        var startGroup = parseInt(loadSetting("lastGroup", "0"), 10);
        if (isNaN(startGroup) || startGroup < 0 || startGroup >= GROUPS.length) startGroup = 0;

        // Ferramentas que estavam recolhidas da última vez.
        for (i = 0; i < groupViews.length; i++) {
            var pend = groupViews[i].pendingCollapse;
            for (var p = 0; p < pend.length; p++) setCollapsed(pend[p], true);
        }

        var activeGroup = startGroup;
        var started = false;

        // Altura real da aba ativa (as outras abas do stack não contam).
        function contentHeight() {
            var h = 0;
            try { h = pages[activeGroup].preferredSize[1]; } catch (e) {}
            if (!h || h < 0) {
                try { h = content.size[1]; } catch (e2) {}
            }
            return h + 6;
        }

        function scrollTo(v) {
            try {
                content.location = [content.location[0], -Math.round(v)];
            } catch (e) {}
        }

        function updateScroll() {
            try {
                var viewH = viewport.size[1];
                var max = Math.max(0, contentHeight() - viewH);

                scrollbar.maxvalue = Math.max(1, max);
                if (scrollbar.value > max) scrollbar.value = max;
                scrollbar.jumpdelta = Math.max(30, Math.round(viewH * 0.9));
                scrollbar.enabled = max > 0;

                scrollTo(max > 0 ? scrollbar.value : 0);
            } catch (e) {}
        }

        scrollbar.onChanging =
        scrollbar.onChange = function () {
            scrollTo(this.value);
        };

        applyResponsive();
        win.layout.layout(true);
        nav.select(startGroup);

        // Janela flutuante: abre num tamanho confortável, rolando o resto.
        if (win instanceof Window) {
            try {
                win.size = [Math.max(win.size[0], 380), Math.min(Math.max(contentHeight() + 120, 300), 760)];
                win.layout.resize();
            } catch (eSize) {}
        }

        updateScroll();

        started = true;

        var lastWidth = -1;

        // Durante o resize: só reposiciona e atualiza a rolagem (leve).
        // Lado a lado/empilhado só é reavaliado quando a largura muda.
        win.onResizing =
        win.onResize = function () {
            var w = 0;
            try { w = this.size[0]; } catch (eW) {}

            if (w !== lastWidth) {
                lastWidth = w;
                if (applyResponsive()) {
                    relayout();
                    return;
                }
            }

            this.layout.resize();
            updateScroll();
        };

        return win;
    }

    // API para outros scripts / KBar:
    // explodeMesmo({split: "words", deleteOriginal: true, layerOrder: "topToBottom"})
    $.global.explodeMesmo = function (options) {
        options = options || {};
        return explodeSelectedText({
            split: options.split || "characters",
            splitWord: options.splitWord || "",
            rtlText: !!options.rtlText,
            deleteOriginal: !!options.deleteOriginal,
            layerOrder: options.layerOrder === "bottomToTop" ? "bottomToTop" : "topToBottom"
        });
    };

    var panel = buildUI(thisObj);

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
