/*
    MesmoTools_EN.jsx
    MESMO TOOLS - single ScriptUI panel for Adobe After Effects (English).

    GENERATED FILE: edit MesmoTools.jsx (Portuguese) and run
    tools/build_en.py to rebuild this file.
    Same version number as the Portuguese file (see SCRIPT_VERSION and
    CHANGELOG.md).

    Tabs:
    - Animation = Curves + Explode (on the same screen)
    - Layers = Create + Anchor Point + Extract + Beats
    - Comps = Settings + Duplicate + 3D / Blur (on the same screen)
    - Expressions: ready-made shortcuts + your favorite expressions

    Files saved in Folder.userData/MesmoTools/ (shared with the
    Portuguese version):
    - speed_curves.txt          (curves)
    - expression_favorites.txt  (expressions)
*/

(function MesmoTools(thisObj) {

    var SCRIPT_NAME = "Mesmo Tools";
    var SCRIPT_VERSION = "2.13";
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
        b.helpTip = "Click to collapse or expand";

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
        "\n\nCheck in Preferences > Scripting & Expressions that " +
        "\"Allow Scripts to Write Files and Access Network\" is enabled.";


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
                    "Invalid duration. Use 0:00:00:00, seconds (10s) or frames (250f)."
                );
            }

            var h = parseInt(m[1], 10);
            var min = parseInt(m[2], 10);
            var sec = parseInt(m[3], 10);
            var fr = parseInt(m[4], 10);

            if (fr >= nominalFPS) {
                throw new Error(
                    "The frames field (" + fr + ") must be less than " +
                    nominalFPS + " for " + fps + " fps."
                );
            }

            totalFrames = ((h * 3600) + (min * 60) + sec) * nominalFPS + fr;
        }

        var duration = totalFrames / fps;

        if (duration <= 0) {
            throw new Error("Duration must be greater than zero.");
        }

        if (duration > 10800) {
            throw new Error("After Effects limits compositions to 3 hours.");
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

        var selectionText = uiFlex(header.add("statictext", undefined, "Select comps in the Project panel."));

        var btnLoad = uiButton(header, "Read 1st Comp", {tip: "Loads the values of the first selected comp"});

        var resizePanel = uiSection(tab, "Resolution");
        resizePanel.orientation = "column";
        resizePanel.alignChildren = ["fill", "top"];

        var cbResize = resizePanel.add("checkbox", undefined, "Apply Resize");

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

        var cbLockRatio = resizePanel.add("checkbox", undefined, "Lock aspect ratio");
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

        var cbFPS = fpsPanel.add("checkbox", undefined, "Apply Frame Rate");

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
                    "Invalid custom FPS. Use a value from 4 to 300 with up to 2 decimals."
                );
            }

            var fps = parseLocalizedNumber(txtCustomFPS.text);
            if (fps < 4 || fps > 300) {
                throw new Error("FPS must be between 4 and 300.");
            }

            return fps;
        }

        var durationPanel = uiSection(tab, "Duration");
        durationPanel.orientation = "column";
        durationPanel.alignChildren = ["fill", "top"];

        var cbDuration = durationPanel.add("checkbox", undefined, "Apply Duration");

        var durationRow = durationPanel.add("group");
        durationRow.orientation = "row";
        durationRow.alignChildren = ["left", "center"];

        uiLabel(durationRow, "Time:");
        var txtDuration = durationRow.add("edittext", undefined, "0:00:10:00");
        uiFlex(txtDuration);
        uiLabel(durationRow, "or 10s / 250f").helpTip = "Timecode H:MM:SS:FF, seconds (10s) or frames (250f)";

        var rendererPanel = uiSection(tab, "3D Renderer");
        rendererPanel.orientation = "column";
        rendererPanel.alignChildren = ["fill", "top"];

        var cbRenderer = rendererPanel.add("checkbox", undefined, "Apply 3D Renderer");

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

        var btnApply = uiButton(tab, "APPLY TO SELECTED COMPS", {primary: true});

        var status = addStatus(tab, "No changes applied yet.");

        function refreshSelectionText() {
            var comps = getSelectedComps();
            if (comps.length === 0) {
                selectionText.text = "No composition selected.";
            } else if (comps.length === 1) {
                selectionText.text = "1 comp: " + comps[0].name;
            } else {
                selectionText.text = comps.length + " comps selected.";
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
                alert("Select at least one composition in the Project panel.");
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

            status.text = "Values loaded from: " + comp.name;
            refreshSelectionText();
        };

        btnApply.onClick = function () {
            var comps = getSelectedComps();

            if (comps.length === 0) {
                alert("Select at least one composition in the Project panel.");
                return;
            }

            if (!cbResize.value && !cbFPS.value && !cbDuration.value && !cbRenderer.value) {
                alert("Enable at least one option to apply.");
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
                    alert("W and H must be whole numbers between 4 and 30000 px.");
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
                                    "After Effects did not accept " +
                                    requestedFPS + " fps in this composition."
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
                                    " is not available in this After Effects installation."
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
                    success + (success === 1 ? " comp updated." : " comps updated.");
            } else {
                status.text =
                    success + " updated, " + errors.length + " with errors.";

                alert(
                    "Finished with some errors:\n\n" +
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

        var pnlNaming = uiSection(tab, "Copy names");
        pnlNaming.orientation = "column";
        pnlNaming.alignChildren = ["fill", "top"];

        var grpSfx = pnlNaming.add("group");
        var cbSfx = grpSfx.add("checkbox", undefined, "");
        cbSfx.value = true;

        var ddType = grpSfx.add("dropdownlist", undefined, ["Suffix", "Prefix"]);
        ddType.selection = 0;

        var txtSfx = grpSfx.add("edittext", undefined, "_Copy");
        uiFlex(txtSfx);

        var grpSrch = pnlNaming.add("group");
        var cbSrch = grpSrch.add("checkbox", undefined, "Search");

        var txtSrch = grpSrch.add("edittext", undefined, "");
        uiFlex(txtSrch);

        uiLabel(grpSrch, "replace with");

        var txtRpl = grpSrch.add("edittext", undefined, "");
        uiFlex(txtRpl);

        var pnlOpts = uiSection(tab, "Options");
        pnlOpts.orientation = "column";
        pnlOpts.alignChildren = ["fill", "top"];

        var folderRow = pnlOpts.add("group");
        folderRow.orientation = "row";
        folderRow.alignChildren = ["fill", "center"];

        var cbFolder = folderRow.add("checkbox", undefined, "Organize in folder");
        var txtFolderName = folderRow.add("edittext", undefined, "");
        txtFolderName.alignment = ["fill", "center"];
        uiFlex(txtFolderName);
        txtFolderName.helpTip = "Empty = uses the suffix without the \"_\" (e.g. _v02 becomes v02)";

        var cbPrecompFolder = pnlOpts.add(
            "checkbox",
            undefined,
            "Put precomps in a PRECOMPS subfolder"
        );
        uiFlex(cbPrecompFolder);

        var previewText = uiFlex(uiLabel(pnlOpts, ""));

        var cbExp = pnlOpts.add("checkbox", undefined, "Update expressions");

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

            return "Copies";
        }

        function precompFolderName() {
            if (usingSuffix()) return "PRECOMPS" + txtSfx.text;
            if (usingPrefix()) return txtSfx.text + "PRECOMPS";
            return "PRECOMPS";
        }

        function refreshDupUI() {
            txtFolderName.enabled = cbFolder.value;
            cbPrecompFolder.enabled = cbFolder.value;
            cbPrecompFolder.text = "Put precomps in subfolder " + precompFolderName();

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
                previewText.text = "Result: " + compName + "  (same folder as the original)";
            } else if (cbPrecompFolder.value) {
                previewText.text =
                    "Result:  [" + resolvedFolderName() + "]  →  " + compName +
                    "  +  [" + precompFolderName() + "]";
            } else {
                previewText.text =
                    "Result:  [" + resolvedFolderName() + "]  →  " + compName + " + precomps";
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

        uiLabel(bottomGrp, "Copies:");

        var copyCount = bottomGrp.add("edittext", undefined, "1");
        copyCount.characters = 4;

        var btnRun = uiButton(bottomGrp, "DUPLICATE SELECTED", {primary: true});
        btnRun.alignment = ["fill", "center"];

        var status = addStatus(tab, "Select one or more comps in the Project panel.");

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
                alert("No project open.");
                return;
            }

            var sel = app.project.selection;

            if (!sel || sel.length === 0) {
                alert("Select at least one composition in the Project panel.");
                return;
            }

            var num = parseInt(copyCount.text, 10);
            if (isNaN(num) || num < 1 || num > 999) {
                alert("Copies must be a number between 1 and 999.");
                return;
            }

            var valid = [];
            for (var i = 0; i < sel.length; i++) {
                if (sel[i] instanceof CompItem) valid.push(sel[i]);
            }

            if (valid.length === 0) {
                alert("The selection has no compositions.");
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
                made + " comp(s) duplicated" +
                (precomps > 0 ? " + " + precomps + " precomp(s)" : "") +
                (cbFolder.value ? " in \"" + baseFolder + "\"" : "") + ".";
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
        if (!input) throw new Error("Enter a regular expression.");

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
                return "vertical text is not supported.";
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
                return "justified text is not supported.";
            }
        } catch (e2) {}

        return null;
    }

    function explodeSelectedText(opts) {
        var comp = app.project ? app.project.activeItem : null;

        if (!isComp(comp)) {
            alert("Open a composition and select one or more text layers.");
            return {pieces: 0, skipped: 0, failed: 0, keptOriginals: 0};
        }

        var selected = comp.selectedLayers;
        var textLayers = [];

        for (var i = 0; i < selected.length; i++) {
            if (isTextLayer(selected[i])) textLayers.push(selected[i]);
        }

        if (textLayers.length === 0) {
            alert("No text layer selected.");
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
                    alert("'" + layer.name + "' was skipped: " + unsupported);
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
                        "Error in '" + layer.name + "':\n" +
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

        var splitPanel = uiSection(tab, "Split");
        splitPanel.orientation = "column";
        splitPanel.alignChildren = ["fill", "top"];

        var rowMode = splitPanel.add("group");
        rowMode.orientation = "row";

        uiLabel(rowMode, "Split into:");

        var ddMode = rowMode.add(
            "dropdownlist",
            undefined,
            [
                "Characters",
                "Words",
                "Lines",
                "Specific word",
                "Regular expression (regex)"
            ]
        );
        ddMode.selection = 0;
        ddMode.alignment = ["fill", "center"];

        var customGroup = splitPanel.add("group");
        customGroup.orientation = "row";

        var customLabel = customGroup.add("statictext", undefined, "Value:");

        var txtCustom = customGroup.add("edittext", undefined, "");
        uiFlex(txtCustom);
        txtCustom.alignment = ["fill", "center"];

        var optionsPanel = uiSection(tab, "Options");
        optionsPanel.orientation = "column";
        optionsPanel.alignChildren = ["left", "top"];

        var cbDelete = optionsPanel.add(
            "checkbox",
            undefined,
            "Delete original layer"
        );

        var cbRTL = optionsPanel.add(
            "checkbox",
            undefined,
            "RTL text (right to left)"
        );

        var orderRow = optionsPanel.add("group");
        orderRow.orientation = "row";
        uiLabel(orderRow, "Layer order:");

        var ddOrder = orderRow.add(
            "dropdownlist",
            undefined,
            ["Top to bottom", "Bottom to top"]
        );
        ddOrder.selection = 0;

        var btnApply = uiButton(tab, "EXPLODE TEXT", {primary: true});

        var status = addStatus(tab, "Select one or more text layers.");

        function refreshCustomState() {
            var idx = ddMode.selection ? ddMode.selection.index : 0;

            customGroup.enabled = idx >= 3;

            if (idx === 3) customLabel.text = "Word:";
            else if (idx === 4) customLabel.text = "Regex:";
            else customLabel.text = "Value:";
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
                        ? "Type the word you want to isolate."
                        : "Type a regular expression."
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
                result.pieces + " layer(s) created" +
                (result.skipped ? " | " + result.skipped + " skipped" : "") +
                (result.failed ? " | " + result.failed + " piece(s) failed" : "") +
                ".";

            if (result.keptOriginals) {
                alert(
                    "Some pieces could not be created, so " +
                    result.keptOriginals +
                    " original layer(s) were kept so you don't lose the text."
                );
            }
        };
    }

    function build3DTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = [0, 6, 0, 0];

        var info = uiFlex(uiLabel(tab, "Comps selected in the Project panel (or the open comp)."));
        info.helpTip = "If nothing is selected in the Project panel, it acts on the open comp.";

        var optionsPanel = uiSection(tab, "Options");
        optionsPanel.orientation = "column";
        optionsPanel.alignChildren = ["left", "top"];

        var recursiveCheckbox = optionsPanel.add("checkbox", undefined, "Process precomps");
        recursiveCheckbox.value = loadSetting("layersRecursive", "1") === "1";

        var lockedCheckbox = optionsPanel.add("checkbox", undefined, "Process locked layers");
        lockedCheckbox.value = loadSetting("layersLocked", "1") === "1";

        // ----- 3D -----
        var sec3D = uiSection(tab, "3D Layers");

        var btns = sec3D.add("group");
        btns.orientation = "row";
        btns.alignChildren = ["fill", "center"];

        var make3DButton = uiButton(btns, "ENABLE 3D", {primary: true});
        var disable3DButton = uiButton(btns, "DISABLE 3D", {height: 32});

        // ----- Motion Blur -----
        var secMB = uiSection(tab, "Motion Blur");

        var compMBCheckbox = secMB.add(
            "checkbox",
            undefined,
            "Also switch the comp's Motion Blur"
        );
        uiFlex(compMBCheckbox);
        compMBCheckbox.value = loadSetting("mbCompSwitch", "1") === "1";
        compMBCheckbox.helpTip =
            "Without the comp switch on, layer blur shows in neither preview nor render.";

        var mbBtns = secMB.add("group");
        mbBtns.orientation = "row";
        mbBtns.alignChildren = ["fill", "center"];

        var mbOnButton = uiButton(mbBtns, "MOTION BLUR ON", {primary: true});
        var mbOffButton = uiButton(mbBtns, "MOTION BLUR OFF", {height: 32});

        var status = addStatus(tab, "Select comps in the Project panel.");

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
                alert("No project open.");
                return;
            }

            var comps = targetComps();

            if (comps.length === 0) {
                alert("Select at least one composition in the Project panel (or open a comp).");
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

            app.beginUndoGroup((enable ? "Enable " : "Disable ") + mode.label);

            try {
                for (var i = 0; i < comps.length; i++) processComp(comps[i]);
            } finally {
                app.endUndoGroup();
            }

            status.text =
                mode.label + (enable ? " on" : " off") + ": " +
                layerCount + " layer(s) in " + compCount + " comp(s)" +
                (compSwitches ? " | comp switch " + (enable ? "on" : "off") + " in " + compSwitches : "") +
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
                throw new Error("Could not open the favorites file.");
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
                "Could not save favorites:\n" +
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
    // MESMO EXPRESSION LIBRARY (English)
    // Built from github.com/francismsmo/After-effects-Expressions.
    // Each shortcut has a description, where to apply it and a tutorial comment.
    // ================================================================

    var EXPRESSION_LIBRARY = [
        {
            name: "Control Delay — Position",
            cat: "Delay",
            target: "Position",
            desc: "The layer follows its parent's Position a few frames late. Use different delay values on each layer for a cascade effect.",
            needs: [],
            code: [
                "/* ============================================================",
                "   CONTROL DELAY — POSITION",
                "   Apply to: Position of the layer that will follow the Control",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   The layer repeats the motion of its parent layer, just a few",
                "   frames late. Gives that \"drag\" / follow-through cascade.",
                "",
                "   How to use:",
                "   1. Create a control layer (e.g. a Null named \"Control\") and",
                "      animate its Position.",
                "   2. Parent the layers that will follow to the Control",
                "      (Parent & Link pick whip).",
                "   3. Paste this expression on the Position of each child layer.",
                "   4. Adjust delayFrames below. Use different values on each",
                "      layer (3, 6, 9...) for the cascade effect.",
                "",
                "   Notes:",
                "   - Without a parent, the layer stays at its own value.",
                "   - Works best with the Control unrotated and at 100% scale,",
                "     because the delay is added in the parent's space.",
                "   ============================================================ */",
                "",
                "var delayFrames = 3; // How many frames of delay you want",
                "var delayTime = framesToTime(delayFrames);",
                "",
                "// The target (your Control object)",
                "var target = parent;",
                "",
                "if (target != null) {",
                "    // Where the Control was 'X' frames ago",
                "    var delayedPos = target.transform.position.valueAtTime(time - delayTime);",
                "",
                "    // Where the Control is NOW",
                "    var currentPos = target.transform.position.valueAtTime(time);",
                "",
                "    // Motion difference (delta)",
                "    var delta = delayedPos - currentPos;",
                "",
                "    // Add the motion to the layer's own value (keeps the layout)",
                "    value + delta;",
                "} else {",
                "    value;",
                "}"
            ].join("\n")
        },
        {
            name: "Control Delay — Rotation",
            cat: "Delay",
            target: "Rotation",
            desc: "The layer repeats its parent's rotation a few frames late.",
            needs: [],
            code: [
                "/* ============================================================",
                "   CONTROL DELAY — ROTATION",
                "   Apply to: Rotation of the layer that will follow the Control",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   The layer repeats the rotation of its parent layer, just a few",
                "   frames late. Gives that \"drag\" / follow-through cascade.",
                "",
                "   How to use:",
                "   1. Create a control layer (e.g. a Null named \"Control\") and",
                "      animate its Rotation.",
                "   2. Parent the layers that will follow to the Control",
                "      (Parent & Link pick whip).",
                "   3. Paste this expression on the Rotation of each child layer.",
                "   4. Adjust delayFrames below. Use different values on each",
                "      layer (3, 6, 9...) for the cascade effect.",
                "",
                "   Notes:",
                "   - Without a parent, the layer stays at its own value.",
                "   - On 3D layers, apply it to Z Rotation.",
                "   ============================================================ */",
                "",
                "var delayFrames = 3; // How many frames of delay",
                "var delayTime = framesToTime(delayFrames);",
                "var target = parent;",
                "",
                "if (target != null) {",
                "    // Parent's rotation difference",
                "    var rotaPaiAtrasada = target.transform.rotation.valueAtTime(time - delayTime);",
                "    var rotaPaiAgora = target.transform.rotation.valueAtTime(time);",
                "    var delta = rotaPaiAtrasada - rotaPaiAgora;",
                "",
                "    // Layer's own rotation + the parent's delay",
                "    value + delta;",
                "} else {",
                "    value;",
                "}"
            ].join("\n")
        },
        {
            name: "Control Delay — Scale",
            cat: "Delay",
            target: "Scale",
            desc: "The layer repeats its parent's scale a few frames late. Great for cascading pops.",
            needs: [],
            code: [
                "/* ============================================================",
                "   CONTROL DELAY — SCALE",
                "   Apply to: Scale of the layer that will follow the Control",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   The layer repeats the scale of its parent layer, just a few",
                "   frames late. Gives that \"drag\" / follow-through cascade.",
                "",
                "   How to use:",
                "   1. Create a control layer (e.g. a Null named \"Control\") and",
                "      animate its Scale.",
                "   2. Parent the layers that will follow to the Control",
                "      (Parent & Link pick whip).",
                "   3. Paste this expression on the Scale of each child layer.",
                "   4. Adjust delayFrames below. Use different values on each",
                "      layer (3, 6, 9...) for the cascade effect.",
                "",
                "   Notes:",
                "   - Without a parent, the layer stays at its own value.",
                "   - Works best with uniform scale on the Control (X = Y)",
                "     and fast animations, like pops.",
                "   ============================================================ */",
                "",
                "var delayFrames = 3; // How many frames of delay",
                "var delayTime = framesToTime(delayFrames);",
                "var target = parent;",
                "",
                "if (target != null) {",
                "    // Parent's scale difference",
                "    var escalaPaiAtrasada = target.transform.scale.valueAtTime(time - delayTime);",
                "    var escalaPaiAgora = target.transform.scale.valueAtTime(time);",
                "    var delta = escalaPaiAtrasada - escalaPaiAgora;",
                "",
                "    // Layer's own scale + the parent's delay",
                "    value + delta;",
                "} else {",
                "    value;",
                "}"
            ].join("\n")
        },
        {
            name: "Growing wiggle",
            cat: "Wiggle",
            target: "Scale",
            desc: "Wiggle that starts still and gets stronger over time, with no limit. Keeps the scale proportional.",
            needs: [],
            code: [
                "/* ============================================================",
                "   GROWING WIGGLE (no limit)",
                "   Apply to: Scale",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Wiggle intensity starts at 0 and grows by growthRate every",
                "   second. It uses the same value for X and Y, so the layer",
                "   pulses without stretching.",
                "",
                "   How to use:",
                "   1. Paste it on the layer's Scale.",
                "   2. growthRate = how much the intensity grows per second.",
                "   3. The 0.5 inside wiggle is the frequency (wiggles per second).",
                "",
                "   Notes:",
                "   - Counts from the start of the comp (time = 0). If the layer",
                "     starts later, replace time with (time - inPoint).",
                "   - Want a ceiling? Use the \"Growing wiggle with limit\" shortcut.",
                "   ============================================================ */",
                "",
                "// Rate defines how much the wiggle intensity increases per second",
                "var growthRate = 10;",
                "var dynamicAmount = time * growthRate;",
                "",
                "// Wiggle(frequency, amplitude)",
                "var w = wiggle(0.5, dynamicAmount);",
                "",
                "// Same value for X and Y = keeps proportions",
                "[w[0], w[0]]"
            ].join("\n")
        },
        {
            name: "Growing wiggle with limit",
            cat: "Wiggle",
            target: "Scale",
            desc: "Like the growing wiggle, but it stops growing when it reaches the limit.",
            needs: [],
            code: [
                "/* ============================================================",
                "   GROWING WIGGLE WITH LIMIT",
                "   Apply to: Scale",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Wiggle intensity grows by growthRate per second until it",
                "   reaches limit, then stays constant. Keeps the scale",
                "   proportional.",
                "",
                "   How to use:",
                "   1. Paste it on the layer's Scale.",
                "   2. growthRate = how much it grows per second.",
                "   3. limit = maximum intensity.",
                "      E.g. growthRate 10 and limit 30 -> reaches the max in 3 s.",
                "",
                "   Note: counts from the start of the comp. If the layer starts",
                "   later, replace time with (time - inPoint).",
                "   ============================================================ */",
                "",
                "var growthRate = 10; // Increases by 10 every second",
                "var limit = 30;      // Maximum intensity",
                "",
                "// This will grow until it hits 30, then stay there",
                "var dynamicAmount = Math.min(time * growthRate, limit);",
                "",
                "var w = wiggle(0.5, dynamicAmount);",
                "",
                "// Same value for X and Y = keeps proportions",
                "[w[0], w[0]]"
            ].join("\n")
        },
        {
            name: "Fading wiggle",
            cat: "Wiggle",
            target: "Rotation",
            desc: "Wiggle that starts strong and calms down until it stops. Good for something that sways and settles.",
            needs: [],
            code: [
                "/* ============================================================",
                "   FADING (DAMPED) WIGGLE",
                "   Apply to: Rotation (works on any property)",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Starts at startAmount intensity and loses decayRate per",
                "   second until it reaches 0, when the layer stops shaking.",
                "",
                "   How to use:",
                "   1. Paste it on the layer's Rotation.",
                "   2. startAmount = starting intensity (degrees, on Rotation).",
                "   3. decayRate = how much it loses per second.",
                "      E.g. 30 and 10 -> fully stops in 3 s.",
                "",
                "   Notes:",
                "   - Also works on Position and Scale; wiggle returns the full",
                "     property value.",
                "   - Counts from the start of the comp. If the layer starts",
                "     later, replace time with (time - inPoint).",
                "   ============================================================ */",
                "",
                "var startAmount = 30; // Starting intensity",
                "var decayRate = 10;   // How much it decreases per second",
                "",
                "// Never negative: stops at 0",
                "var dynamicAmount = Math.max(startAmount - (time * decayRate), 0);",
                "",
                "// On Rotation, wiggle already returns the final value",
                "wiggle(0.5, dynamicAmount);"
            ].join("\n")
        },
        {
            name: "Looping wiggle",
            cat: "Wiggle",
            target: "Any property",
            desc: "Wiggle that repeats seamlessly every X seconds, with no jump at the loop point. Ideal for looping videos and GIFs.",
            needs: [],
            code: [
                "/* ============================================================",
                "   SEAMLESS LOOPING WIGGLE",
                "   Apply to: any property (Position, Rotation, Scale...)",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Blends two identical wiggles offset by loopTime. The end of",
                "   the cycle matches the start exactly, so it repeats with no",
                "   \"jump\".",
                "",
                "   How to use:",
                "   1. Paste it on the property.",
                "   2. freq = how many times per second it moves.",
                "   3. amp = size of the motion (px, degrees or %).",
                "   4. loopTime = loop length in seconds. Use the comp duration",
                "      (or a fraction of it) so the loop closes perfectly.",
                "   ============================================================ */",
                "",
                "// --- SETTINGS ---",
                "freq = 2;       // Frequency (how many times it moves per second)",
                "amp = 50;       // Amplitude (distance/size of the variation)",
                "loopTime = 10;  // Loop length in seconds",
                "",
                "// --- LOOP CALCULATION ---",
                "t = time % loopTime;",
                "w1 = wiggle(freq, amp, 1, 0.5, t);",
                "w2 = wiggle(freq, amp, 1, 0.5, t - loopTime);",
                "",
                "// Blend between the first and second wiggle",
                "linear(t, 0, loopTime, w1, w2);"
            ].join("\n")
        },
        {
            name: "Proportional scale wiggle",
            cat: "Wiggle",
            target: "Scale",
            desc: "Wiggle on Scale without stretching: width and height change together.",
            needs: [],
            code: [
                "/* ============================================================",
                "   SCALE WIGGLE THAT KEEPS PROPORTIONS",
                "   Apply to: Scale",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   A regular wiggle on Scale picks X and Y separately and the",
                "   layer \"stretches\". Here X is used for both axes, so it only",
                "   grows and shrinks evenly.",
                "",
                "   How to use:",
                "   1. Paste it on Scale.",
                "   2. wiggle(5, 30): 5 = frequency (times per second),",
                "      30 = intensity (in %).",
                "   ============================================================ */",
                "",
                "//This Wiggle on Scale keep the aspect ratio the same.",
                "w = wiggle(5, 30);",
                "",
                "// Same value for X and Y",
                "[w[0], w[0]]"
            ].join("\n")
        },
        {
            name: "Reveal text letter by letter",
            cat: "Text",
            target: "Range Selector > Start",
            desc: "Reveals the text one letter per frame, typewriter style. The duration adapts to the text length.",
            needs: [],
            code: [
                "/* ============================================================",
                "   REVEAL TEXT LETTER BY LETTER",
                "   Apply to: Start of the Range Selector of an Opacity animator",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Animates Start from 0 to 100 over as many frames as the text",
                "   has letters: 1 letter per frame. If the text changes, the",
                "   duration follows.",
                "",
                "   How to use:",
                "   1. On the text layer: Animate > Opacity.",
                "   2. In the new animator, set Opacity = 0%.",
                "   3. Open Range Selector 1 and paste this expression on Start.",
                "   4. The text appears from left to right.",
                "",
                "   Tips:",
                "   - Slower: replace framesToTime(numChars) with",
                "     framesToTime(numChars * 2) (2 frames per letter).",
                "   - Starts at the beginning of the comp. To start when the",
                "     layer comes in, replace time with (time - inPoint).",
                "   ============================================================ */",
                "",
                "//Add an Opacity 0% animator and put this code on Start",
                "",
                "var numChars = text.sourceText.length;  // how many letters the text has",
                "var finalTime = framesToTime(numChars); // 1 frame per letter",
                "linear(time, 0, finalTime, 0, 100);"
            ].join("\n")
        },
        {
            name: "Chain APOIO text after PRINCIPAL",
            cat: "Text",
            target: "Range Selector > Start (APOIO layer)",
            desc: "Makes the APOIO layer's animation start on its own as soon as the PRINCIPAL layer finishes animating (Start reaches 100).",
            needs: [],
            code: [
                "/* ============================================================",
                "   CHAINED TEXT: APOIO STARTS WHEN PRINCIPAL FINISHES",
                "   Apply to: Start of the Range Selector of the APOIO layer",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Watches the Start of the PRINCIPAL layer's Range Selector.",
                "   When it reaches 100 (animation done), APOIO's Start goes from",
                "   0 to 100 in 15 frames. If you change PRINCIPAL's timing,",
                "   APOIO follows on its own.",
                "",
                "   How to use:",
                "   1. Have two text layers named PRINCIPAL and APOIO, each with",
                "      \"Animator 1\" > \"Range Selector 1\".",
                "   2. Animate (or use an expression on) PRINCIPAL's Start up to 100.",
                "   3. Paste this expression on Start of APOIO's Range Selector.",
                "   4. Adjust the duration in framesToTime(15).",
                "",
                "   Notes:",
                "   - The layer, animator and selector names must match exactly.",
                "     If you rename them, change them here too.",
                "   - The expression searches backwards frame by frame; in very",
                "     long comps it may slow the preview down a bit.",
                "   ============================================================ */",
                "",
                "// Apply to the Start of the APOIO layer's Range Selector",
                "// The animation starts when the PRINCIPAL layer's Start reaches 100.",
                "",
                "var anterior = thisComp",
                "    .layer(\"PRINCIPAL\")",
                "    .text",
                "    .animator(\"Animator 1\")",
                "    .selector(\"Range Selector 1\")",
                "    .start;",
                "",
                "var duracao = framesToTime(15); // APOIO animation length",
                "",
                "if (anterior < 100){",
                "    0; // PRINCIPAL still animating: APOIO waits",
                "}else{",
                "    var inicio = time;",
                "",
                "    // Go back in time until the frame where PRINCIPAL reached 100",
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
                "    // From there, animate from 0 to 100",
                "    linear(time, inicio, inicio + duracao, 0, 100);",
                "}"
            ].join("\n")
        },
        {
            name: "2-digit counter (00–99)",
            cat: "Numbers",
            target: "Source Text",
            desc: "Shows a Slider's value as a whole number with a leading zero (00, 01... 10). For counters and scoreboards.",
            needs: ["Slider Control"],
            code: [
                "/* ============================================================",
                "   2-DIGIT COUNTER (00, 01, 02... 10, 11...)",
                "   Apply to: Source Text of a text layer",
                "   Needs: a \"Slider Control\" effect on the same layer",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Rounds the Slider value and adds a zero in front of numbers",
                "   below 10.",
                "",
                "   How to use:",
                "   1. On the text layer, add Effect > Expression Controls",
                "      > Slider Control (the panel creates it if missing).",
                "   2. Paste this expression on Source Text.",
                "   3. Animate the Slider (e.g. from 0 to 10) and the text counts.",
                "   ============================================================ */",
                "",
                "s = Math.round(effect(\"Slider Control\")(\"Slider\"));",
                "",
                "// Below 10 gets a zero in front",
                "if (s < 10) { \"0\" + s } else { s.toString() }"
            ].join("\n")
        },
        {
            name: "6-digit counter (000.000)",
            cat: "Numbers",
            target: "Source Text",
            desc: "Shows a Slider's value with 6 digits and a thousands dot (000.000). For view counters, amounts, etc.",
            needs: ["Slider Control"],
            code: [
                "/* ============================================================",
                "   6-DIGIT COUNTER (000.000)",
                "   Apply to: Source Text of a text layer",
                "   Needs: a \"Slider Control\" effect on the same layer",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Rounds the Slider, pads it with zeros to 6 digits and puts a",
                "   dot in the middle. E.g. 1234 -> \"001.234\".",
                "",
                "   How to use:",
                "   1. Add a Slider Control to the text layer (the panel creates",
                "      it if missing).",
                "   2. Paste this expression on Source Text.",
                "   3. Animate the Slider from 0 to the final value (max 999999).",
                "",
                "   Note: negative numbers and values above 999.999 don't fit",
                "   the format.",
                "   ============================================================ */",
                "",
                "s = Math.round(effect(\"Slider Control\")(\"Slider\"));",
                "",
                "// Pad with zeros on the left and keep the last 6 digits",
                "txt = (\"000000\" + s).slice(-6);",
                "",
                "// Dot separating the thousands",
                "txt.slice(0, 3) + \".\" + txt.slice(3);"
            ].join("\n")
        },
        {
            name: "Camera timecode (00:00:SS:FF)",
            cat: "Numbers",
            target: "Source Text",
            desc: "Fakes a camera timecode from a Slider that counts frames (30 fps): shows 00:00:seconds:frames.",
            needs: ["Slider Control"],
            code: [
                "/* ============================================================",
                "   CAMERA TIMECODE (00:00:SS:FF at 30 fps)",
                "   Apply to: Source Text of a text layer",
                "   Needs: a \"Slider Control\" effect on the same layer",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   The Slider is a FRAME counter. The expression divides by 30",
                "   and shows seconds and frames in camera timecode format:",
                "   fixed \"00:00:\" + SS:FF.",
                "   (In the code, \"minutos\" holds the seconds and \"segundos\"",
                "   holds the frames.)",
                "",
                "   How to use:",
                "   1. Add a Slider Control to the text layer (the panel creates",
                "      it if missing).",
                "   2. Paste this expression on Source Text.",
                "   3. Animate the Slider. E.g. 0 -> 300 over 10 s makes the",
                "      timecode run in real time at 30 fps.",
                "      Shortcut: on the Slider, use the expression  time * 30",
                "",
                "   Tip: for another fps, replace both 30s with the fps you want.",
                "   ============================================================ */",
                "",
                "v = Math.floor(effect(\"Slider Control\")(\"Slider\")); // total frames",
                "",
                "minutos = Math.floor(v / 30); // seconds (30 frames = 1 s)",
                "segundos = v % 30;            // leftover frames",
                "",
                "minTxt = (minutos < 10) ? (\"0\" + minutos) : minutos.toString();",
                "segTxt = (segundos < 10) ? (\"0\" + segundos) : segundos.toString();",
                "",
                "// fixed text + timecode",
                "\"00:00:\" + minTxt + \":\" + segTxt;"
            ].join("\n")
        },
        {
            name: "Reactive box — text Anchor Point",
            cat: "Layout",
            target: "Anchor Point (text layer)",
            desc: "Reactive box part 1: centers the text's Anchor Point, so text and box line up by the center.",
            needs: [],
            code: [
                "/* ============================================================",
                "   REACTIVE BOX — PART 1: TEXT ANCHOR POINT",
                "   Apply to: Anchor Point of the TEXT layer",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Puts the Anchor Point exactly at the center of the text,",
                "   whatever its size. The text grows to both sides and stays",
                "   aligned with the box.",
                "",
                "   How to use (together with Part 2):",
                "   1. Replace \"nome da camada\" with your text layer's name",
                "      (it can be the layer itself: thisLayer also works).",
                "   2. Paste it on the text's Anchor Point.",
                "   3. On the box (shape), use the \"Reactive box — box Size\"",
                "      shortcut.",
                "   4. Align text and box at the same position (or parent them).",
                "   ============================================================ */",
                "",
                "///Text layer - Anchor Point:",
                "",
                "a = thisComp.layer(\"nome da camada\").sourceRectAtTime();",
                "",
                "Height = a.height;",
                "Width = a.width;",
                "Left = a.left;",
                "Top = a.top;",
                "",
                "// Center of the text rectangle",
                "x = Left + Width / 2;",
                "y = Top + Height / 2;",
                "",
                "[x, y]"
            ].join("\n")
        },
        {
            name: "Reactive box — box Size",
            cat: "Layout",
            target: "Rectangle Path > Size (box shape)",
            desc: "Reactive box part 2: the box (shape) resizes on its own to fit the text, with padding controlled by a Slider.",
            needs: ["Slider Control"],
            code: [
                "/* ============================================================",
                "   REACTIVE BOX — PART 2: BOX SIZE",
                "   Apply to: Size of the Rectangle Path on the SHAPE (box) layer",
                "   Needs: a \"Slider Control\" effect on the box layer",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Reads the text size and makes the rectangle that size plus",
                "   padding (the Slider value). Change the text, the box follows.",
                "",
                "   How to use:",
                "   1. Create a rectangle (shape layer > Rectangle).",
                "   2. Add a Slider Control to the box layer (the panel creates",
                "      it if missing). It is the padding in px.",
                "   3. Replace \"nome da camada\" with the text layer's name.",
                "   4. Paste it on the Rectangle Path's Size.",
                "   5. Use Part 1 on the text's Anchor Point to center it.",
                "",
                "   Tip: the padding is added to the total; with Slider 40 you get",
                "   20 px on each side.",
                "   ============================================================ */",
                "",
                "///Box layer - Size within the parameters:",
                "",
                "a = thisComp.layer(\"nome da camada\").sourceRectAtTime();",
                "",
                "Height = a.height;",
                "Width = a.width;",
                "",
                "p = effect(\"Slider Control\")(\"Slider\"); // padding",
                "x = Width + p;",
                "y = Height + p;",
                "",
                "[x, y]"
            ].join("\n")
        },
        {
            name: "Size from sliders (Width/Height)",
            cat: "Layout",
            target: "Rectangle Path > Size",
            desc: "Controls a rectangle's size with two sliders on a CONTROLES layer. Good for keeping several controls in one place.",
            needs: [],
            code: [
                "/* ============================================================",
                "   SIZE FROM SLIDERS",
                "   Apply to: Size of the Rectangle Path (or any [x, y] value)",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Takes width and height from two Sliders on a control layer.",
                "   Several boxes can use the same sliders and change together.",
                "",
                "   How to use:",
                "   1. Create a Null named CONTROLES.",
                "   2. Add two Slider Controls to it and rename them",
                "      \"Largura\" (width) and \"Altura\" (height).",
                "   3. Paste this expression on the box's Rectangle Path Size.",
                "   4. Move the sliders on CONTROLES.",
                "   ============================================================ */",
                "",
                "w = thisComp.layer(\"CONTROLES\").effect(\"Largura\")(\"Slider\");",
                "h = thisComp.layer(\"CONTROLES\").effect(\"Altura\")(\"Slider\");",
                "",
                "[w, h]"
            ].join("\n")
        },
        {
            name: "Constant size to camera (Scale x Z)",
            cat: "3D",
            target: "Scale (3D layer)",
            desc: "Keeps the layer's apparent size the same even when it moves closer to or farther from the camera.",
            needs: [],
            code: [
                "/* ============================================================",
                "   CONSTANT SIZE TO CAMERA (Scale x Position Z)",
                "   Apply to: Scale of a 3D layer",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Measures the distance between the layer and the active",
                "   camera and corrects the scale by the same ratio. Result: the",
                "   layer always looks the same size on screen, even when Z",
                "   changes or the camera moves. Great for text, icons and",
                "   markers that follow a 3D scene.",
                "",
                "   How to use:",
                "   1. Turn on the layer's 3D and have a camera in the comp.",
                "   2. Paste this expression on Scale.",
                "   3. Scale is 100% when the layer is at the camera's Zoom",
                "      distance.",
                "",
                "   Notes:",
                "   - With no camera in the comp, the original scale is kept.",
                "   - Use it on layers without a parent (it uses the local",
                "     position).",
                "   ============================================================ */",
                "",
                "try {",
                "    // Get the comp's active camera",
                "    cam = thisComp.activeCamera;",
                "",
                "    // Distance from the camera to the layer's Anchor Point",
                "    distance = length(sub(position, cam.position));",
                "",
                "    // Camera focal distance (where scale is 100%)",
                "    zoom = cam.zoom;",
                "",
                "    // Inverse scale factor",
                "    scaleFactor = (distance / zoom) * 100;",
                "",
                "    // Apply the factor on X, Y and Z",
                "    [scaleFactor, scaleFactor, scaleFactor];",
                "} catch(err) {",
                "    // No camera in the scene: keep the original scale to avoid errors",
                "    value;",
                "}"
            ].join("\n")
        },
        {
            name: "Decelerate to a stop",
            cat: "Motion",
            target: "Rotation (or any 1D value)",
            desc: "Motion that starts fast and brakes until it stops, like a spinning wheel. Uniformly decelerated motion physics.",
            needs: [],
            code: [
                "/* ============================================================",
                "   DECELERATE TO A STOP",
                "   Apply to: Rotation (or any 1-value property: opacity,",
                "             separated X Position, Slider...)",
                "   ------------------------------------------------------------",
                "   What it does:",
                "   Simulates something that starts at speed vInicial and brakes",
                "   (desaceleracao per second) until it stops, then stays still.",
                "   E.g. a prize wheel spinning and stopping.",
                "",
                "   How to use:",
                "   1. Paste it on the layer's Rotation.",
                "   2. vInicial = starting speed (degrees per second).",
                "   3. desaceleracao = how much the speed drops per second.",
                "      E.g. 150 and 20 -> stops at 7.5 s, after turning 562.5°.",
                "",
                "   Notes:",
                "   - The value replaces the property's. To add it to the",
                "     rotation you already have, change the last line to",
                "     value + (vInicial * t) - (desaceleracao * Math.pow(t, 2) / 2);",
                "   - On Position (2D), separate dimensions and use it on X or Y.",
                "   ============================================================ */",
                "",
                "var vInicial = 150;     // Starting speed",
                "var desaceleracao = 20; // How much it decreases per second",
                "var tOriginal = Math.max(0, time); // Makes sure time is never negative",
                "",
                "// 1. How long until the speed reaches zero",
                "var tempoParaParar = vInicial / desaceleracao;",
                "",
                "// 2. Never let the time used go past the stopping point",
                "var t = Math.min(tOriginal, tempoParaParar);",
                "",
                "// 3. Displacement formula (uniformly varied motion)",
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

        var ALL = "All";
        var MINE = "★ Mine";

        var favorites = loadExpressionFavorites();
        var shown = [];     // entradas visíveis na lista, na mesma ordem
        var current = null; // entrada carregada no editor
        var busy = false;

        // ----- Lista -----
        var libSec = uiSection(tab, "Shortcuts and favorites");

        var filterRow = libSec.add("group");
        filterRow.orientation = "row";
        filterRow.alignChildren = ["fill", "center"];

        var ddCat = filterRow.add("dropdownlist", undefined, []);
        ddCat.preferredSize.width = 120;

        var txtSearch = filterRow.add("edittext", undefined, "");
        txtSearch.alignment = ["fill", "center"];
        txtSearch.helpTip = "Search by name or description";

        var list = libSec.add("listbox", undefined, [], {
            multiselect: false,
            numberOfColumns: 2,
            showHeaders: true,
            columnTitles: ["Expression", "Apply to"],
            columnWidths: [230, 150]
        });
        list.alignment = ["fill", "fill"];
        list.preferredSize.height = 170;

        var infoText = libSec.add("statictext", undefined, "", {multiline: true});
        infoText.alignment = ["fill", "top"];
        infoText.preferredSize.height = 58;
        uiColorText(infoText, THEME.textDim);

        // ----- Editor -----
        var edSec = uiSection(tab, "Expression");

        var nameRow = edSec.add("group");
        nameRow.orientation = "row";
        nameRow.alignChildren = ["fill", "center"];

        uiLabel(nameRow, "Name:");
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

        var btnNew = uiButton(manageRow, "New", {tip: "Clears the editor"});
        var btnSave = uiButton(manageRow, "Save", {tip: "Saves to your favorites (★ Mine)"});
        var btnDelete = uiButton(manageRow, "Delete", {tip: "Deletes one of your favorites"});
        var btnCapture = uiButton(manageRow, "Capture", {tip: "Copies the expression from the selected property"});

        // ----- Aplicar -----
        var applySec = uiSection(tab, "Apply");

        var cbNeeds = applySec.add("checkbox", undefined, "Create the Slider Control on the layer if the expression needs it");
        cbNeeds.value = loadSetting("exprCreateControls", "1") === "1";

        var btnApply = uiButton(applySec, "APPLY TO SELECTED PROPERTIES", {primary: true});

        var status = addStatus(tab, "Click a shortcut to see its tutorial. Double-click applies it.");

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
                infoText.text = "Expression saved by you.";
                return;
            }

            infoText.text =
                e.desc + "\n" +
                "Apply to: " + e.target +
                (e.needs.length ? "   ·   Needs: " + e.needs.join(", ") : "");
        }

        function loadSelected() {
            if (busy || !list.selection) return;

            var e = shown[list.selection.index];
            if (!e) return;

            current = e;
            txtName.text = e.name;
            txtCode.text = e.code;
            describe(e);
            status.text = (e.kind === "lib" ? "Shortcut: " : "Favorite: ") + e.name;
        }

        function applyCurrentExpression() {
            var code = txtCode.text;

            if (trimString(code) === "") {
                alert("The expression is empty.");
                return;
            }

            var props = collectSelectedExpressionProperties();

            if (props.length === 0) {
                alert("Select one or more properties that accept expressions.");
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

            app.beginUndoGroup("Mesmo Tools - Expression" + (current ? " " + current.name : ""));

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
                    var propName = "Property";
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
                applied + " propert(ies) updated" +
                (created ? " | " + created + " Slider Control(s) created" : "") +
                (errors.length ? " | " + errors.length + " error(s)" : "") +
                (warnings.length ? " | " + warnings.length + " with expression errors" : "") +
                ".";

            if (errors.length || warnings.length) {
                var msg = "";
                if (errors.length) {
                    msg += "Could not apply to:\n" + errors.join("\n");
                }
                if (warnings.length) {
                    if (msg) msg += "\n\n";
                    msg += "Applied, but the expression has an error in:\n" + warnings.join("\n") +
                        "\n\nCheck the tutorial at the top of the expression: you may need to " +
                        "rename a layer or create a control.";
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
            status.text = "New expression: write or capture it, name it and save.";
        };

        btnSave.onClick = function () {
            var name = trimString(txtName.text);
            var code = txtCode.text;

            if (name === "") {
                alert("Give the expression a name.");
                return;
            }

            if (trimString(code) === "") {
                alert("The expression is empty.");
                return;
            }

            // Um atalho do Mesmo nunca é sobrescrito: vira uma cópia sua.
            for (var i = 0; i < EXPRESSION_LIBRARY.length; i++) {
                if (EXPRESSION_LIBRARY[i].name === name) {
                    name += " (mine)";
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
                status.text = "Saved to ★ Mine: " + name;
            }
        };

        btnDelete.onClick = function () {
            if (current && current.kind === "lib") {
                alert("Mesmo shortcuts can't be deleted. Only your favorites (★ Mine).");
                return;
            }

            var name = trimString(txtName.text);
            if (name === "" && current) name = current.name;

            var idx = findFavoriteIndex(favorites, name);

            if (idx === -1) {
                alert("Select one of your favorites to delete.");
                return;
            }

            if (!confirm("Delete the expression \"" + name + "\"?")) return;

            favorites.splice(idx, 1);

            if (saveExpressionFavorites(favorites)) {
                current = null;
                txtName.text = "";
                txtCode.text = "";
                describe(null);
                refreshList(null);
                status.text = "Expression deleted: " + name;
            }
        };

        btnCapture.onClick = function () {
            var props = collectSelectedExpressionProperties();

            if (props.length === 0) {
                alert("Select a property with an expression.");
                return;
            }

            var captured = "";
            try { captured = props[0].expression; } catch (e) {}

            if (trimString(captured) === "") {
                alert("The first selected property has no expression.");
                return;
            }

            current = null;
            list.selection = null;
            txtCode.text = captured;
            describe(null);

            if (trimString(txtName.text) === "") {
                try { txtName.text = props[0].name; } catch (nameErr) { txtName.text = "Expression"; }
            }

            status.text = "Expression captured. Name it and save.";
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
        ["Linear", "Basics", 0.333, 0.333, 0.667, 0.667, 0],
        ["Easy Ease (AE)", "Basics", 0.333, 0, 0.667, 1, 1],
        ["Easy Ease In (AE)", "Basics", 0.167, 0.167, 0.667, 1, 0],
        ["Easy Ease Out (AE)", "Basics", 0.333, 0, 0.833, 0.833, 0],
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
            cat: String(cat || "Mine"),
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

            if (!f.open("w")) throw new Error("Could not open the file.");

            f.writeln("# Mesmo Tools speed curves v1 | name<TAB>category<TAB>x1,y1,x2,y2<TAB>favorite");

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
                "Could not save curves:\n" +
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

    // Fica de fora só o que o After não deixa ter ease (só Hold).
    // Paths de máscara/shape, cores e parâmetros de efeito entram.
    function isCurveCompatibleProperty(p) {
        try {
            if (p.propertyType !== PropertyType.PROPERTY) return false;
            if (!p.canVaryOverTime || p.numKeys < 2) return false;

            var vt = p.propertyValueType;
            if (
                vt === PropertyValueType.NO_VALUE ||
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
        Velocidade média do trecho por dimensão, nas unidades do After.
        - Números/vetores: (v2 - v1) / tempo.
        - Paths de máscara e de shape (e outros tipos sem número): o próprio
          After calcula. O trecho fica linear por um instante e a velocidade
          que ele mostra é a média.
    */
    function segmentAverageSpeeds(prop, k1, k2, easeLen, dt) {
        var out = [];
        var d;
        var deltas = keyDeltas(prop, k1, k2, easeLen);

        if (deltas) {
            for (d = 0; d < easeLen; d++) out.push(deltas[d] / dt);
            return out;
        }

        var LIN = KeyframeInterpolationType.LINEAR;
        prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), LIN);
        prop.setInterpolationTypeAtKey(k2, LIN, prop.keyOutInterpolationType(k2));

        var e = prop.keyOutTemporalEase(k1);
        for (d = 0; d < easeLen; d++) out.push(e[d] ? e[d].speed : 0);
        return out;
    }

    /*
        Prepara um trecho UMA vez (no clique): interpolação Bezier, sem
        auto-bezier/continuous e velocidade média. Durante o arraste só o
        ease é reaplicado, o que é bem mais leve para o After.
    */
    function prepareCurveSegment(prop, k1, k2) {
        var dt = prop.keyTime(k2) - prop.keyTime(k1);
        if (dt <= 0) return null;

        var easeLen = prop.keyOutTemporalEase(k1).length;
        var avg = segmentAverageSpeeds(prop, k1, k2, easeLen, dt);
        var BEZ = KeyframeInterpolationType.BEZIER;

        prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), BEZ);
        prop.setInterpolationTypeAtKey(k2, BEZ, prop.keyOutInterpolationType(k2));

        try { prop.setTemporalContinuousAtKey(k1, false); } catch (e1) {}
        try { prop.setTemporalAutoBezierAtKey(k1, false); } catch (e2) {}
        try { prop.setTemporalContinuousAtKey(k2, false); } catch (e3) {}
        try { prop.setTemporalAutoBezierAtKey(k2, false); } catch (e4) {}

        return {prop: prop, k1: k1, k2: k2, easeLen: easeLen, avg: avg};
    }

    /*
        Conversão (mesma ideia do Flow):
        saída da 1ª key:   influence = x1 * 100,       speed = (y1 / x1) * velocidadeMédia
        entrada da 2ª key: influence = (1 - x2) * 100, speed = ((1 - y2) / (1 - x2)) * velocidadeMédia
        mode: "both" | "out" | "in"
    */
    function applyPreparedCurve(seg, c, mode) {
        var x1 = Math.max(0.001, Math.min(1, c.x1));
        var x2 = Math.max(0, Math.min(0.999, c.x2));
        var outInf = Math.max(0.1, Math.min(100, x1 * 100));
        var inInf = Math.max(0.1, Math.min(100, (1 - x2) * 100));
        var outEase = [];
        var inEase = [];

        for (var d = 0; d < seg.easeLen; d++) {
            outEase.push(new KeyframeEase((c.y1 / x1) * seg.avg[d], outInf));
            inEase.push(new KeyframeEase(((1 - c.y2) / (1 - x2)) * seg.avg[d], inInf));
        }

        // o outro lado de cada key é lido na hora: trechos encadeados
        // (k1-k2, k2-k3) não sobrescrevem um ao outro
        if (mode !== "in") {
            seg.prop.setTemporalEaseAtKey(seg.k1, seg.prop.keyInTemporalEase(seg.k1), outEase);
        }
        if (mode !== "out") {
            seg.prop.setTemporalEaseAtKey(seg.k2, inEase, seg.prop.keyOutTemporalEase(seg.k2));
        }

        return true;
    }

    function applyCurveToSegment(prop, k1, k2, c, mode) {
        var seg = prepareCurveSegment(prop, k1, k2);
        if (!seg) return false;
        return applyPreparedCurve(seg, c, mode);
    }

    // Keyframes selecionadas: [{prop, keys:[...]}] nas propriedades que aceitam ease.
    function collectSelectedKeyframes(comp) {
        var props = [];
        var out = [];
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
            try {
                if (props[i].propertyType !== PropertyType.PROPERTY) continue;
                var keys = props[i].selectedKeys;
                if (!keys || keys.length === 0) continue;
                if (!isCurveCompatibleProperty(props[i])) continue;
                out.push({prop: props[i], keys: keys});
            } catch (e3) {}
        }

        return out;
    }

    /*
        Easy ease clássico, por keyframe (como o F9 / Keyframe Velocity):
        velocidade 0 e só a influência muda.
        side: "in" (lado que chega), "out" (lado que sai) ou "both".
    */
    function applyClassicEase(entries, side, inInf, outInf) {
        var BEZ = KeyframeInterpolationType.BEZIER;
        var count = 0;

        inInf = Math.max(0.1, Math.min(100, inInf));
        outInf = Math.max(0.1, Math.min(100, outInf));

        for (var i = 0; i < entries.length; i++) {
            var p = entries[i].prop;
            var keys = entries[i].keys;

            for (var j = 0; j < keys.length; j++) {
                var k = keys[j];
                var curIn = p.keyInTemporalEase(k);
                var curOut = p.keyOutTemporalEase(k);
                var newIn = curIn;
                var newOut = curOut;
                var d;

                if (side !== "out") {
                    newIn = [];
                    for (d = 0; d < curIn.length; d++) newIn.push(new KeyframeEase(0, inInf));
                }
                if (side !== "in") {
                    newOut = [];
                    for (d = 0; d < curOut.length; d++) newOut.push(new KeyframeEase(0, outInf));
                }

                p.setInterpolationTypeAtKey(
                    k,
                    side !== "out" ? BEZ : p.keyInInterpolationType(k),
                    side !== "in" ? BEZ : p.keyOutInterpolationType(k)
                );
                try { p.setTemporalContinuousAtKey(k, false); } catch (e1) {}
                try { p.setTemporalAutoBezierAtKey(k, false); } catch (e2) {}

                p.setTemporalEaseAtKey(k, newIn, newOut);
                count++;
            }
        }

        return count;
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
        var LIVE_INTERVAL = 100; // ms entre aplicações durante o arraste

        var curves = readCurveFile(getCurveStoreFile());
        if (!curves) {
            curves = defaultCurves();
            try { writeCurveFile(getCurveStoreFile(), curves); } catch (eSeed) {}
        }

        var lib = {
            selected: null,
            edit: makeCurve("", "Mine", 0.333, 0, 0.667, 1, false),
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
        ddCurves.helpTip = "Pick a curve: it is applied to the selected keyframes right away";

        var btnFav = uiButton(libRow, "★", {width: 28, tip: "Favorite / unfavorite (favorites show at the top)"});

        // ----- Editor -----
        var edRow = tab.add("group");
        edRow.orientation = "row";
        edRow.alignChildren = ["left", "top"];
        edRow.spacing = 8;

        var editor = edRow.add("group");
        editor.alignment = ["left", "top"];
        editor.preferredSize = [128, 128];
        editor.helpTip = "Drag the handles: selected keyframes update live. Shift rounds values.";

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
        var modeRow = sideRow("Graph:");
        modeRow.spacing = 2;
        var btnModeValue = uiButton(modeRow, "Value", {tip: "Value curve (like the Value Graph)"});
        var btnModeSpeed = uiButton(modeRow, "Speed", {tip: "Speed curve (like the Speed Graph): handles = influence and speed"});
        uiFlex(btnModeValue, 30);
        uiFlex(btnModeSpeed, 30);

        var txtValues = uiFlex(sideRow("Bezier:").add("edittext", undefined, ""));
        txtValues.helpTip = "x1, y1, x2, y2 — you can paste from cubic-bezier.com. Enter applies.";

        var infoText = uiFlex(uiLabel(edSide, ""));
        infoText.helpTip = "Influence (%) and speed (× the segment's average speed) of each keyframe.";

        var txtName = sideRow("Name:").add("edittext", undefined, "");
        uiFlex(txtName);

        var txtCat = sideRow("Category:").add("edittext", undefined, "Mine");
        uiFlex(txtCat);
        txtCat.helpTip = "Type an existing category or create a new one";

        var manageRow = edSide.add("group");
        manageRow.orientation = "row";
        manageRow.alignChildren = ["fill", "center"];
        manageRow.spacing = 4;

        var btnSave = uiButton(manageRow, "Save", {tip: "Saves to the library (updates if the name exists)"});
        var btnDelete = uiButton(manageRow, "Delete");

        // ----- Clássico (easy ease com influência ajustável) -----
        var classicSec = uiSection(tab, "Classic");
        var classic = {
            "in": parseFloat(loadSetting("classicIn", "33.33")),
            "out": parseFloat(loadSetting("classicOut", "33.33")),
            "both": parseFloat(loadSetting("classicBoth", "33.33")),
            last: 0
        };
        var CLASSIC_ROWS = [
            {side: "in", glyph: "<", tip: "In: influence on the incoming side of each keyframe"},
            {side: "out", glyph: ">", tip: "Out: influence on the outgoing side of each keyframe"},
            {side: "both", glyph: "×", tip: "Both: same influence on in and out"}
        ];
        var classicCtl = {};

        function fmtInf(v) {
            v = Math.max(0.1, Math.min(100, v));
            return v < 10 ? String(Math.round(v * 10) / 10) : String(Math.round(v));
        }

        // Ícone do botão de aplicar: quadrado, meio-diamante e círculo, como na referência.
        function drawClassicIcon(state) {
            var g = this.graphics;
            var w = this.size[0];
            var h = this.size[1];
            var c = state.leftButtonPressed ? THEME.accentDown : (state.mouseOver ? THEME.accentHover : THEME.accent);
            var cx = w / 2;
            var cy = h / 2;
            var r = 6;

            if (state.mouseOver) {
                uiRoundRect(g, 0, 0, w, h, 4);
                g.fillPath(uiBrush(g, THEME.surface));
            }

            g.newPath();
            if (this.mesmoSide === "in") {
                uiRoundRect(g, cx - r, cy - r, r * 2, r * 2, 2);
            } else if (this.mesmoSide === "out") {
                g.moveTo(cx, cy - r - 1);
                g.lineTo(cx + r + 1, cy);
                g.lineTo(cx, cy + r + 1);
                g.lineTo(cx - r - 1, cy);
                g.closePath();
                g.fillPath(uiBrush(g, c));
                // metade "vazada": ease só de um lado
                g.newPath();
                g.moveTo(cx, cy - r + 3);
                g.lineTo(cx - r + 2, cy);
                g.lineTo(cx, cy + r - 3);
                g.closePath();
                g.fillPath(uiBrush(g, THEME.well));
                return;
            } else {
                g.ellipsePath(cx - r, cy - r, r * 2, r * 2);
            }
            g.fillPath(uiBrush(g, c));
        }

        function drawGlyph() {
            var g = this.graphics;
            var font = uiFont("BOLD", 13);
            uiText(g, this.mesmoGlyph, font, THEME.textDim, 0, 0, this.size[0], this.size[1]);
        }

        function classicApply(side, undoName) {
            var comp = app.project ? app.project.activeItem : null;
            if (!isComp(comp)) {
                status.text = "Open a comp and select keyframes.";
                return;
            }

            var entries = collectSelectedKeyframes(comp);
            if (entries.length === 0) {
                status.text = "Select keyframes to apply the classic ease.";
                return;
            }

            var inInf = side === "both" ? classic.both : classic["in"];
            var outInf = side === "both" ? classic.both : classic.out;
            var n = 0;

            app.beginUndoGroup(undoName || "Mesmo Tools - Classic ease");
            try {
                n = applyClassicEase(entries, side, inInf, outInf);
            } finally {
                app.endUndoGroup();
            }

            var label = side === "in" ? "In " + fmtInf(inInf) + "%"
                : side === "out" ? "Out " + fmtInf(outInf) + "%"
                : "In and out " + fmtInf(inInf) + "%";
            status.text = "Classic: " + label + " in " + n + " keyframe(s).";
        }

        function setClassicValue(side, v, fromSlider) {
            v = Math.max(0.1, Math.min(100, v));
            classic[side] = v;
            saveSetting(side === "in" ? "classicIn" : side === "out" ? "classicOut" : "classicBoth", v);

            var ctl = classicCtl[side];
            ctl.field.text = fmtInf(v);
            if (!fromSlider) ctl.slider.value = v;

            // "Ambos" acompanha: mexer nele ajusta também os outros dois
            if (side === "both") {
                classic["in"] = v;
                classic.out = v;
                classicCtl["in"].slider.value = v;
                classicCtl["in"].field.text = fmtInf(v);
                classicCtl.out.slider.value = v;
                classicCtl.out.field.text = fmtInf(v);
            }
        }

        for (var cr = 0; cr < CLASSIC_ROWS.length; cr++) {
            var def = CLASSIC_ROWS[cr];
            var rowC = classicSec.add("group");
            rowC.orientation = "row";
            rowC.alignChildren = ["fill", "center"];
            rowC.spacing = 6;

            var glyph = rowC.add("group");
            glyph.preferredSize = [14, 22];
            glyph.mesmoGlyph = def.glyph;
            glyph.onDraw = drawGlyph;
            glyph.helpTip = def.tip;

            var sl = rowC.add("slider", undefined, classic[def.side], 0.1, 100);
            sl.alignment = ["fill", "center"];
            sl.preferredSize.width = 60;
            sl.helpTip = def.tip;

            var fld = rowC.add("edittext", undefined, fmtInf(classic[def.side]));
            fld.characters = 4;
            fld.helpTip = def.tip + " (0.1 to 100)";

            var ico = rowC.add("button", undefined, "");
            ico.preferredSize = [24, 24];
            ico.mesmoSide = def.side;
            ico.onDraw = drawClassicIcon;
            ico.helpTip = "Apply " + (def.side === "in" ? "to the in side" : def.side === "out" ? "to the out side" : "to both sides") + " of the selected keyframes";

            classicCtl[def.side] = {slider: sl, field: fld};

            (function (side, slider, field, icon) {
                // arrastando: aplica ao vivo, no máximo a cada 100 ms
                slider.onChanging = function () {
                    setClassicValue(side, slider.value, true);
                    if (cbLive.value && new Date().getTime() - classic.last >= 100) {
                        classic.last = new Date().getTime();
                        classicApply(side, "Mesmo Tools - Classic ease (drag)");
                    }
                };
                // soltou: valor final exato
                slider.onChange = function () {
                    setClassicValue(side, slider.value, true);
                    if (cbLive.value) classicApply(side);
                };
                field.onChange = function () {
                    var v = parseFloat(String(field.text).replace(",", "."));
                    if (isNaN(v)) {
                        field.text = fmtInf(classic[side]);
                        return;
                    }
                    setClassicValue(side, v, false);
                    if (cbLive.value) classicApply(side);
                };
                icon.onClick = function () {
                    classicApply(side);
                };
            })(def.side, sl, fld, ico);
        }

        var cbLive = uiFlex(tab.add("checkbox", undefined, "Live on selected keyframes"));
        cbLive.value = loadSetting("curvesLive", "1") === "1";

        var status = addStatus(tab, "Select keyframes and use the editor.");

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

        // Prepara os trechos (uma vez). Os que falharem são contados.
        function prepareSegments(raw) {
            var out = [];
            var failed = 0;

            for (var i = 0; i < raw.length; i++) {
                try {
                    var seg = prepareCurveSegment(raw[i][0], raw[i][1], raw[i][2]);
                    if (seg) out.push(seg);
                } catch (e) {
                    failed++;
                }
            }

            return {segments: out, failed: failed};
        }

        // Aplica a curva do editor nos trechos já preparados.
        function applyToSegments(prepared, failedBefore) {
            var ok = 0;
            var failed = failedBefore || 0;

            for (var i = 0; i < prepared.length; i++) {
                try {
                    if (applyPreparedCurve(prepared[i], lib.edit, "both")) ok++;
                } catch (e) {
                    failed++;
                }
            }

            return {ok: ok, failed: failed};
        }

        function liveStatus(r, skipped) {
            if (!cbLive.value) {
                status.text = "Live is off.";
            } else if (!r || (r.ok === 0 && r.failed === 0)) {
                status.text = "Select keyframes to see the curve on the timeline.";
            } else {
                status.text =
                    "Live: " + r.ok + " segment(s)" +
                    (r.failed ? " | " + r.failed + " failed" : "") +
                    (skipped ? " | " + skipped + " unsupported propert(ies)" : "") + ".";
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
                var prep = prepareSegments(found.segments);
                r = applyToSegments(prep.segments, prep.failed);
            } finally {
                app.endUndoGroup();
            }

            liveStatus(r, found.skipped);
        }

        // Cada atualização fecha o próprio Undo: nada fica aberto se o mouse
        // for solto fora do painel.
        function applyLive() {
            // nada mudou desde a última vez: não incomoda o After
            var sig = curveValuesText(lib.edit);
            if (sig === live.lastSig) return;
            live.lastSig = sig;

            var r;
            app.beginUndoGroup("Mesmo Tools - Curve (drag)");
            try {
                r = applyToSegments(live.segments, live.failed);
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
                    // prepara uma vez (interpolação, velocidade média)
                    app.beginUndoGroup("Mesmo Tools - Curve (drag)");
                    try {
                        var prep = prepareSegments(found.segments);
                        live.segments = prep.segments;
                        live.failed = prep.failed;
                    } finally {
                        app.endUndoGroup();
                    }
                    live.skipped = found.skipped;
                    live.lastSig = "";
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

            addItem(null, lib.selected ? "— custom curve —" : "— pick a curve —");

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
                "Out " + Math.round(e.x1 * 100) + "% · " + (Math.round(sp.s1 * 10) / 10) + "×   " +
                "In " + Math.round((1 - e.x2) * 100) + "% · " + (Math.round(sp.s2 * 10) / 10) + "×";
        }

        function loadIntoEditor(c) {
            lib.selected = c ? c.name : null;
            lib.edit = c
                ? makeCurve(c.name, c.cat, c.x1, c.y1, c.x2, c.y2, c.fav)
                : makeCurve("", txtCat.text || "Mine", 0.333, 0, 0.667, 1, false);

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
            applyOnce("Mesmo Tools - Curve " + c.name);
        };

        txtValues.onChange = function () {
            var v = parseCurveValues(txtValues.text);

            if (!v) {
                alert("Use 4 numbers: x1, y1, x2, y2 (e.g. 0.4, 0, 0.2, 1).");
                syncEditorFields();
                return;
            }

            var e = lib.edit;
            lib.edit = makeCurve(e.name, e.cat, v[0], v[1], v[2], v[3], e.fav);
            lib.selected = null;
            syncEditorFields();
            uiRedraw(editor);
            applyOnce("Mesmo Tools - Curve");
        };

        cbLive.onClick = function () {
            saveSetting("curvesLive", cbLive.value ? "1" : "0");
            if (cbLive.value) applyOnce("Mesmo Tools - Curve");
            else liveStatus(null, 0);
        };

        btnSave.onClick = function () {
            var name = trimString(txtName.text);
            var cat = trimString(txtCat.text) || "Mine";

            if (name === "") {
                alert("Give the curve a name.");
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
                status.text = (idx === -1 ? "Curve saved: " : "Curve updated: ") + name;
            }
        };

        btnFav.onClick = function () {
            var idx = lib.selected === null ? -1 : findCurveIndex(curves, lib.selected);
            if (idx === -1) {
                alert("Pick (or save) a library curve first.");
                return;
            }

            curves[idx].fav = !curves[idx].fav;
            if (persist()) {
                refreshDropdown();
                status.text = curves[idx].fav ? "Favorited: " + curves[idx].name : "Unfavorited: " + curves[idx].name;
            }
        };

        btnDelete.onClick = function () {
            var idx = lib.selected === null ? -1 : findCurveIndex(curves, lib.selected);
            if (idx === -1) {
                alert("Pick a library curve to delete.");
                return;
            }

            var name = curves[idx].name;
            if (!confirm("Delete the curve \"" + name + "\"?")) return;

            curves.splice(idx, 1);
            if (persist()) {
                lib.selected = null;
                refreshDropdown();
                status.text = "Curve deleted: " + name;
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
            alert("Open a composition first.");
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

        app.beginUndoGroup("Mesmo Tools - Create layer");

        try {
            if (kind === "text") {
                var textName = uniqueLayerName(comp, "Text");
                layer = comp.layers.addText("Text");
                layer.name = textName;
            } else if (kind === "adjustment") {
                layer = comp.layers.addSolid([1, 1, 1], uniqueLayerName(comp, "Adjustment Layer"),
                    w, h, comp.pixelAspect, comp.duration);
                layer.adjustmentLayer = true;
            } else if (kind === "nullLayer") {
                layer = comp.layers.addNull(comp.duration);
                layer.name = uniqueLayerName(comp, "Null");
            } else if (kind === "solid") {
                layer = comp.layers.addSolid(solidColor, uniqueLayerName(comp, "Solid"),
                    w, h, comp.pixelAspect, comp.duration);
            } else if (kind === "shape") {
                layer = comp.layers.addShape();
                layer.name = uniqueLayerName(comp, "Shape");
            } else if (kind === "camera") {
                layer = comp.layers.addCamera(uniqueLayerName(comp, "Camera"), center);
            } else if (kind === "light") {
                layer = comp.layers.addLight(uniqueLayerName(comp, "Light"), center);
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
                "// Follows the null " + nul.name + " (Mesmo Tools)\n" +
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
            "// Follows the null " + nul.name + " (Mesmo Tools)\n" +
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
        if (!(layer instanceof ShapeLayer)) return {pieces: 0, reason: "not a shape layer"};

        var comp = layer.containingComp;
        var contents = layer.property("ADBE Root Vectors Group");
        var groups = [];
        var i;

        for (i = 1; i <= contents.numProperties; i++) {
            if (contents.property(i).matchName === "ADBE Vector Group") {
                groups.push({index: i, name: contents.property(i).name});
            }
        }

        if (groups.length < 2) return {pieces: 0, reason: "has fewer than 2 groups"};

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
        if (!cmd) throw new Error("Couldn't find After Effects' \"Convert Audio to Keyframes\" command.");

        var before = comp.numLayers;
        app.executeCommand(cmd);

        if (comp.numLayers <= before) throw new Error("After Effects did not create the Audio Amplitude layer.");

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
            [{k: "text", label: "Text"}, {k: "adjustment", label: "Adjust."}, {k: "nullLayer", label: "Null"}, {k: "solid", label: "Solid"}],
            [{k: "shape", label: "Shape"}, {k: "camera", label: "Camera"}, {k: "light", label: "Light"}]
        ];
        var TIPS = {
            text: "Text layer",
            adjustment: "Comp-sized Adjustment Layer",
            nullLayer: "Null Object",
            solid: "Comp-sized solid (pick a color)",
            shape: "Empty Shape Layer",
            camera: "Centered camera",
            light: "Centered (Point) light"
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
                    if (layer) status.text = "Created: " + layer.name;
                };
            }
        }

        var btnNull = uiButton(tab, "NULL TO POSITION", {
            primary: true,
            tip: "Select one or more layers: creates a null at their point and links Position to it. Several layers = one single null that moves them all."
        });

        status = addStatus(tab, "Click to create in the open comp.");

        btnNull.onClick = function () {
            var comp = activeCompOrAlert();
            if (!comp) return;

            var layers = layersForNull(comp);
            if (layers.length === 0) {
                alert("Select one or more layers.");
                return;
            }

            var nul = null;
            app.beginUndoGroup("Mesmo Tools - Null to position");
            try {
                nul = createPositionNull(comp, layers);
                selectOnly(comp, [nul]);
            } catch (e) {
                alert("Could not create the null:\n" + e.toString().replace("Error: ", ""));
            } finally {
                app.endUndoGroup();
            }

            if (nul) {
                status.text = "Null created: " + nul.name +
                    (layers.length > 1 ? " (" + layers.length + " layers)" : "");
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
            ["Top left", "Top", "Top right"],
            ["Left", "Center", "Right"],
            ["Bottom left", "Bottom", "Bottom right"]
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
                alert("Select one or more layers.");
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

            status.text = "Anchor at \"" + this.mesmoName + "\" on " + ok + " layer(s).";
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
            "Moves the Anchor Point to the corner, edge or center of the layer without moving it.",
            {multiline: true}), 60);
        help.alignment = ["fill", "fill"];
        uiColorText(help, THEME.textDim);

        status = addStatus(tab, "Select layers and click a point.");
    }

    function buildExtractTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 6;
        tab.margins = [0, 6, 0, 0];

        var info = uiFlex(uiLabel(tab, "Splits each shape-layer group into its own layer."), 60);
        info.helpTip = "Each group in Contents becomes its own layer, in the same position.";

        var cbCenter = uiFlex(tab.add("checkbox", undefined, "Center each piece's anchor"));
        cbCenter.value = loadSetting("extractCenter", "1") === "1";

        var cbDelete = uiFlex(tab.add("checkbox", undefined, "Delete the original (otherwise just hide it)"));
        cbDelete.value = loadSetting("extractDelete", "0") === "1";

        var btn = uiButton(tab, "EXTRACT SHAPES", {primary: true});
        var status = addStatus(tab, "Select shape layers with 2 or more groups.");

        btn.onClick = function () {
            var comp = activeCompOrAlert();
            if (!comp) return;

            var layers = comp.selectedLayers;
            if (layers.length === 0) {
                alert("Select one or more shape layers.");
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

            status.text = total + " layer(s) created" + (skipped.length ? " | " + skipped.length + " skipped" : "") + ".";
            if (skipped.length && total === 0) alert("Nothing to extract:\n\n" + skipped.join("\n"));
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

        uiLabel(sensRow, "Sensitivity:");
        var sens = sensRow.add("slider", undefined, parseFloat(loadSetting("beatSens", "5")), 1, 10);
        sens.alignment = ["fill", "center"];
        sens.preferredSize.width = 60;
        sens.helpTip = "Higher = more beats (catches weaker ones too)";
        var sensVal = uiLabel(sensRow, "");
        sensVal.preferredSize.width = 22;

        var gapRow = tab.add("group");
        gapRow.orientation = "row";
        gapRow.alignChildren = ["left", "center"];

        uiLabel(gapRow, "Minimum gap:");
        var txtGap = gapRow.add("edittext", undefined, loadSetting("beatGap", "6"));
        txtGap.characters = 4;
        uiLabel(gapRow, "frames");

        var cbClear = uiFlex(tab.add("checkbox", undefined, "Delete the layer's old markers"));
        cbClear.value = loadSetting("beatClear", "1") === "1";

        var cbNumber = uiFlex(tab.add("checkbox", undefined, "Number the markers (1, 2, 3...)"));
        cbNumber.value = loadSetting("beatNumber", "0") === "1";

        var btn = uiButton(tab, "MARK BEATS", {primary: true});
        var status = addStatus(tab, "Select a layer with audio.");

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
                alert("Select one audio layer (just one).");
                return;
            }

            var layer = layers[0];
            var hasAudio = false;
            try { hasAudio = layer.hasAudio; } catch (eA) {}
            if (!hasAudio) {
                alert("The layer \"" + layer.name + "\" has no audio.");
                return;
            }

            var gap = parseInt(txtGap.text, 10);
            if (isNaN(gap) || gap < 1) gap = 1;

            saveSetting("beatSens", sens.value);
            saveSetting("beatGap", gap);
            saveSetting("beatClear", cbClear.value ? "1" : "0");
            saveSetting("beatNumber", cbNumber.value ? "1" : "0");

            status.text = "Analyzing audio...";

            var count = 0;
            app.beginUndoGroup("Mesmo Tools - Mark beats");
            try {
                count = markBeats(layer, {
                    sensitivity: sens.value,
                    minGap: gap,
                    clear: cbClear.value,
                    numbered: cbNumber.value
                });
            } catch (e) {
                status.text = "Could not analyze.";
                alert(e.toString().replace("Error: ", ""));
                return;
            } finally {
                app.endUndoGroup();
            }

            status.text = count + " beat(s) marked on \"" + layer.name + "\".";
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
                label: "Animation", abbr: "Anim", tip: "Speed curves + text Explode",
                tools: [
                    {label: "Curves", build: buildCurvesTab, width: 330},
                    {label: "Explode", build: buildExplodeTab, width: 290}
                ]
            },
            {
                label: "Layers", abbr: "Lyr", tip: "Create layers, null to position, anchor point, extract and beats",
                tools: [
                    {label: "Create", build: buildCreateTab, width: 260},
                    {label: "Anchor Point", build: buildAnchorTab, width: 240},
                    {label: "Extract", build: buildExtractTab, width: 250},
                    {label: "Beats", build: buildBeatsTab, width: 260}
                ]
            },
            {
                label: "Comps", abbr: "Comp", tip: "Comp settings + Duplicate + 3D / Motion Blur",
                tools: [
                    {label: "Settings", build: buildCompsTab, width: 300},
                    {label: "Duplicate", build: buildDuplicaTab, width: 300},
                    {label: "3D / Blur", build: build3DTab, width: 270}
                ]
            },
            {
                label: "Expressions", abbr: "Expr", tip: "Expression shortcuts and your favorites",
                tools: [
                    {label: "Expressions", build: buildExpressionsTab, width: 360, noHeader: true}
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

        var LAYOUT_LABELS = {auto: "Auto", wide: "Side by side", stacked: "Stacked"};
        var btnLayout = uiButton(topRow, "⇆", {width: 28, height: 28});
        btnLayout.alignment = ["right", "fill"];
        btnLayout.helpTip = "Tool layout: " + LAYOUT_LABELS[layoutMode] +
            "\n(click to cycle: Auto → Side by side → Stacked)";

        btnLayout.onClick = function () {
            layoutMode = layoutMode === "auto" ? "wide" : (layoutMode === "wide" ? "stacked" : "auto");
            saveSetting("layoutMode", layoutMode);
            btnLayout.helpTip = "Tool layout: " + LAYOUT_LABELS[layoutMode] +
                "\n(click to cycle: Auto → Side by side → Stacked)";
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

    /*
        Dentro de painéis, o After às vezes engole erros dos botões e a ação
        simplesmente "não acontece". Aqui todo handler ganha um try/catch que
        mostra a mensagem exata (com a linha) para dar para corrigir.
    */
    function reportUIError(ctrl, e) {
        var label = "";
        try { label = ctrl.text || ctrl.helpTip || ctrl.type; } catch (eL) {}
        try { app.endUndoGroup(); } catch (eU) {}

        alert(
            SCRIPT_NAME + " — something went wrong in \"" + String(label).substring(0, 60) + "\":\n\n" +
            (e && e.message ? e.message : String(e)) +
            (e && e.line ? "\n(line " + e.line + ")" : "")
        );
    }

    function guardHandlers(container) {
        var kids = container.children;
        var events = ["onClick", "onChange", "onChanging", "onDoubleClick"];

        for (var i = 0; i < kids.length; i++) {
            var k = kids[i];

            for (var j = 0; j < events.length; j++) {
                var fn = k[events[j]];
                if (typeof fn === "function" && !fn.mesmoGuarded) {
                    k[events[j]] = (function (ctrl, f) {
                        var g = function () {
                            try {
                                return f.apply(this, arguments);
                            } catch (e) {
                                reportUIError(ctrl, e);
                            }
                        };
                        g.mesmoGuarded = true;
                        return g;
                    })(k, fn);
                }
            }

            try {
                if (k.children && k.children.length) guardHandlers(k);
            } catch (eC) {}
        }
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
    try { guardHandlers(panel); } catch (eGuard) {}

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
