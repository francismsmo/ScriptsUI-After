/*
    TextExploder_Mesmo.jsx
    Clean-room ScriptUI panel for Adobe After Effects.

    Features:
    - Split selected text layers into Characters, Words, Lines,
      Custom Word, or Custom Regular Expression.
    - Preserves visual placement by measuring composed text baselines.
    - Preserves per-character styles on After Effects 24.3+ via CharacterRange.
    - Supports point text and paragraph/box text.
    - Keeps layer transforms, including 3D and animated transforms, by duplicating the source layer.
    - Optional RTL ordering, Delete Original, and layer stack order.
    - Exposes a small scripting API: explodeMesmo(options) / getExplodeMesmoAPI().

    Notes:
    - Like the commercial tool whose public feature set inspired this clean-room implementation,
      justified paragraph text and vertical text are intentionally rejected.
    - Best results require After Effects 24.3+.
*/

(function ExplodeMesmoPanel(thisObj) {
    var SCRIPT_NAME = "TextExploder Mesmo";
    var SETTINGS_SECTION = "TextExploderMesmo";

    function safeAlert(message, silent) {
        if (!silent) alert(message);
    }

    function isComp(item) {
        return item && (item instanceof CompItem);
    }

    function isTextLayer(layer) {
        if (!layer) return false;
        try {
            return layer.property("ADBE Text Properties") !== null &&
                   layer.property("ADBE Text Properties").property("ADBE Text Document") !== null;
        } catch (e) {
            return false;
        }
    }

    function getSourceTextProp(layer) {
        return layer.property("ADBE Text Properties").property("ADBE Text Document");
    }

    function getDocAtTime(layer, t) {
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
            return doc && typeof doc.composedLineRange === "function" &&
                   typeof doc.composedLineCount !== "undefined";
        } catch (e) {
            return false;
        }
    }

    function isWhitespaceOnly(s) {
        return /^s*$/.test(s);
    }

    function isLineBreakChar(ch) {
        return ch === "" || ch === "
";
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
        var doc = getDocAtTime(layer, t);
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
        try { b = doc.baselineLocs; } catch (e) { b = null; }

        if (b && b.length >= 4 && Math.abs(b[0]) < 1e30 && Math.abs(b[1]) < 1e30) {
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

                    out.push({ start: s, end: e, lineIndex: i });
                }
                return out;
            } catch (e1) {
                out = [];
            }
        }

        var start = 0;
        for (i = 0; i <= text.length; i++) {
            if (i === text.length || isLineBreakChar(text.charAt(i))) {
                out.push({ start: start, end: i, lineIndex: out.length });
                if (text.charAt(i) === "" && text.charAt(i + 1) === "
") i++;
                start = i + 1;
            }
        }
        return out;
    }

    function getOriginalLineBaseline(doc, lineIndex, layer) {
        var b = null;
        try { b = doc.baselineLocs; } catch (e) { b = null; }
        var k = lineIndex * 4;

        if (b && b.length >= k + 4 && Math.abs(b[k]) < 1e30 && Math.abs(b[k + 1]) < 1e30) {
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
        var i;
        for (i = 0; i < lineRanges.length; i++) {
            if (index >= lineRanges[i].start && index < lineRanges[i].end) return lineRanges[i];
        }
        if (lineRanges.length && index === lineRanges[lineRanges.length - 1].end) {
            return lineRanges[lineRanges.length - 1];
        }
        return null;
    }

    function splitRangeAcrossLines(range, lineRanges) {
        var out = [];
        var i, s, e;
        for (i = 0; i < lineRanges.length; i++) {
            s = Math.max(range.start, lineRanges[i].start);
            e = Math.min(range.end, lineRanges[i].end);
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

    function makeCharacterSegments(text, lineRanges) {
        var out = [];
        var i, e, chunk, line;
        i = 0;
        while (i < text.length) {
            e = nextUnicodeCharEnd(text, i);
            chunk = text.substring(i, e);
            if (!isWhitespaceOnly(chunk)) {
                line = findLineForIndex(lineRanges, i);
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

    function makeWordSegments(text, lineRanges) {
        var out = [];
        var re = /S+/g;
        var m, pieces, i;
        while ((m = re.exec(text)) !== null) {
            pieces = splitRangeAcrossLines(
                { start: m.index, end: m.index + m[0].length },
                lineRanges
            );
            for (i = 0; i < pieces.length; i++) out.push(pieces[i]);
            if (m[0].length === 0) re.lastIndex++;
        }
        return out;
    }

    function makeLineSegments(lineRanges) {
        var out = [];
        var i;
        for (i = 0; i < lineRanges.length; i++) {
            if (lineRanges[i].end > lineRanges[i].start) {
                out.push({
                    start: lineRanges[i].start,
                    end: lineRanges[i].end,
                    lineIndex: lineRanges[i].lineIndex,
                    lineStart: lineRanges[i].start,
                    lineEnd: lineRanges[i].end
                });
            }
        }
        return out;
    }

    function pushCustomChunks(out, text, fromIndex, matchStart, matchEnd) {
        if (matchStart > fromIndex && !isWhitespaceOnly(text.substring(fromIndex, matchStart))) {
            out.push({ start: fromIndex, end: matchStart });
        }
        if (matchEnd > matchStart && !isWhitespaceOnly(text.substring(matchStart, matchEnd))) {
            out.push({ start: matchStart, end: matchEnd });
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
        if (cursor < text.length && !isWhitespaceOnly(text.substring(cursor))) {
            out.push({ start: cursor, end: text.length });
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
        var m, start, end;

        while ((m = re.exec(text)) !== null) {
            start = m.index;
            end = m.index + m[0].length;
            pushCustomChunks(out, text, cursor, start, end);
            cursor = end;

            if (m[0].length === 0) {
                re.lastIndex++;
                cursor = Math.max(cursor, re.lastIndex);
            }
        }

        if (cursor < text.length && !isWhitespaceOnly(text.substring(cursor))) {
            out.push({ start: cursor, end: text.length });
        }
        return out;
    }

    function normalizeCustomRangesToLines(ranges, lineRanges) {
        var out = [];
        var i, pieces, j;
        for (i = 0; i < ranges.length; i++) {
            pieces = splitRangeAcrossLines(ranges[i], lineRanges);
            for (j = 0; j < pieces.length; j++) out.push(pieces[j]);
        }
        return out;
    }

    function buildSegments(doc, mode, customValue) {
        var text = doc.text;
        var lines = getLineRanges(doc);
        var ranges;

        if (mode === "characters") return makeCharacterSegments(text, lines);
        if (mode === "words") return makeWordSegments(text, lines);
        if (mode === "lines") return makeLineSegments(lines);

        if (mode === "custom word") {
            ranges = makeCustomWordRanges(text, customValue);
            return normalizeCustomRangesToLines(ranges, lines);
        }

        if (mode === "custom regular expression") {
            ranges = makeRegexRanges(text, customValue);
            return normalizeCustomRangesToLines(ranges, lines);
        }

        return [];
    }

    function isUnsupportedText(doc) {
        try {
            if (typeof LineOrientation !== "undefined" &&
                doc.lineOrientation !== LineOrientation.HORIZONTAL) {
                return "Texto vertical não é suportado.";
            }
        } catch (e1) {}

        try {
            if (doc.justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT ||
                doc.justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT ||
                doc.justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER ||
                doc.justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_FULL ||
                doc.justification === ParagraphJustification.MULTIPLE_JUSTIFICATIONS) {
                return "Texto com alinhamento justificado não é suportado.";
            }
        } catch (e2) {}

        return null;
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

    function offsetPropertyValue(prop, delta) {
        var i, v, nv;
        try {
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
        var anchor = layer.property("ADBE Transform Group").property("ADBE Anchor Point");
        var anchorDelta = [-visualDelta[0], -visualDelta[1], 0];
        offsetPropertyValue(anchor, anchorDelta);
    }

    function cleanPieceName(pieceText) {
        var s = pieceText.replace(/[
	]+/g, " ");
        s = s.replace(/^s+|s+$/g, "");
        if (s.length > 28) s = s.substring(0, 25) + "...";
        return s || "Text";
    }

    function createPieceLayer(sourceLayer, helper, originalDoc, segment, t) {
        var lineBaseline = getOriginalLineBaseline(originalDoc, segment.lineIndex, sourceLayer);
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

        var pieceDoc = cloneRangeDoc(sourceLayer, t, segment.start, segment.end);
        var pieceText = pieceDoc.text;
        var newLayer = sourceLayer.duplicate();

        setStaticSourceText(newLayer, pieceDoc);

        var natural = getBaselineStartAndEnd(newLayer).start;
        var visualDelta = [
            desiredBaseline[0] - natural[0],
            desiredBaseline[1] - natural[1]
        ];

        shiftAnchorByLocalDelta(newLayer, visualDelta);

        try {
            newLayer.name = cleanPieceName(pieceText);
        } catch (e) {}

        return newLayer;
    }

    function reorderCreatedLayers(created, sourceLayer, layerOrder, rtlText) {
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

    function normalizeOptions(opts) {
        opts = opts || {};

        return {
            split: opts.split || "characters",
            splitWord: typeof opts.splitWord === "string" ? opts.splitWord : "",
            rtlText: opts.rtlText === true,
            deleteOriginal: opts.deleteOriginal === true,
            layerOrder: opts.layerOrder === "bottomToTop" ? "bottomToTop" : "topToBottom",
            layerArray: opts.layerArray || null,
            silent: opts.silent === true
        };
    }

    function explodeCore(options) {
        var opts = normalizeOptions(options);
        var comp = app.project ? app.project.activeItem : null;
        var selected = opts.layerArray;
        var textLayers = [];
        var i, layer, doc, unsupported, segments, helper, created, j;
        var totalPieces = 0;
        var skipped = 0;

        if (!isComp(comp)) {
            safeAlert("Abra uma composição e selecione uma ou mais camadas de texto.", opts.silent);
            return { pieces: 0, skipped: 0 };
        }

        if (!selected) selected = comp.selectedLayers;

        if (!selected || selected.length === 0) {
            safeAlert("Selecione uma ou mais camadas de texto.", opts.silent);
            return { pieces: 0, skipped: 0 };
        }

        for (i = 0; i < selected.length; i++) {
            if (isTextLayer(selected[i])) textLayers.push(selected[i]);
        }

        if (textLayers.length === 0) {
            safeAlert("Nenhuma camada de texto selecionada.", opts.silent);
            return { pieces: 0, skipped: selected.length };
        }

        app.beginUndoGroup(SCRIPT_NAME + " - Explode");

        try {
            for (i = 0; i < textLayers.length; i++) {
                layer = textLayers[i];
                doc = getDocAtTime(layer, comp.time);

                unsupported = isUnsupportedText(doc);

                if (unsupported) {
                    skipped++;
                    safeAlert(layer.name + ": " + unsupported, opts.silent);
                    continue;
                }

                try {
                    segments = buildSegments(doc, opts.split, opts.splitWord);
                } catch (segErr) {
                    skipped++;
                    safeAlert(
                        "Não foi possível criar a divisão em '" +
                        layer.name +
                        "':
" +
                        segErr.toString(),
                        opts.silent
                    );
                    continue;
                }

                if (!segments || segments.length === 0) {
                    skipped++;

                    if (opts.split === "custom word" ||
                        opts.split === "custom regular expression") {
                        safeAlert(
                            "Nenhuma correspondência encontrada em '" +
                            layer.name +
                            "'.",
                            opts.silent
                        );
                    }

                    continue;
                }

                helper = layer.duplicate();

                try {
                    helper.name = "__EXPLODE_MESMO_MEASURE__";
                    helper.shy = true;
                } catch (e0) {}

                created = [];

                for (j = 0; j < segments.length; j++) {
                    try {
                        created.push(
                            createPieceLayer(
                                layer,
                                helper,
                                doc,
                                segments[j],
                                comp.time
                            )
                        );
                    } catch (pieceErr) {}
                }

                try {
                    helper.remove();
                } catch (e1) {}

                reorderCreatedLayers(
                    created,
                    layer,
                    opts.layerOrder,
                    opts.rtlText
                );

                totalPieces += created.length;

                if (opts.deleteOriginal) {
                    try {
                        layer.remove();
                    } catch (e2) {}
                }
            }
        } finally {
            app.endUndoGroup();
        }

        if (!opts.silent) {
            var msg =
                totalPieces +
                " camada" +
                (totalPieces === 1 ? " criada" : "s criadas") +
                ".";

            if (skipped > 0) {
                msg += " " + skipped + " camada(s) ignorada(s).";
            }

            return {
                pieces: totalPieces,
                skipped: skipped,
                message: msg
            };
        }

        return {
            pieces: totalPieces,
            skipped: skipped
        };
    }

    function saveSetting(key, value) {
        try {
            app.settings.saveSetting(
                SETTINGS_SECTION,
                key,
                String(value)
            );
        } catch (e) {}
    }

    function loadSetting(key, fallback) {
        try {
            if (app.settings.haveSetting(SETTINGS_SECTION, key)) {
                return app.settings.getSetting(SETTINGS_SECTION, key);
            }
        } catch (e) {}

        return fallback;
    }

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window(
                "palette",
                SCRIPT_NAME,
                undefined,
                { resizeable: true }
            );

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 12;

        var header = win.add(
            "statictext",
            undefined,
            "TEXT EXPLODER MESMO"
        );

        header.alignment = ["fill", "top"];

        var splitPanel = win.add(
            "panel",
            undefined,
            "Split"
        );

        splitPanel.orientation = "column";
        splitPanel.alignChildren = ["fill", "top"];
        splitPanel.margins = 10;

        var rowMode = splitPanel.add("group");
        rowMode.orientation = "row";
        rowMode.add("statictext", undefined, "Dividir em:");

        var ddMode = rowMode.add(
            "dropdownlist",
            undefined,
            [
                "Characters",
                "Words",
                "Lines",
                "Custom word",
                "Custom regular expression"
            ]
        );

        ddMode.alignment = ["fill", "center"];

        var customGroup = splitPanel.add("group");
        customGroup.orientation = "row";
        customGroup.add("statictext", undefined, "Valor:");

        var txtCustom = customGroup.add(
            "edittext",
            undefined,
            ""
        );

        txtCustom.alignment = ["fill", "center"];
        txtCustom.characters = 22;

        var optionsPanel = win.add(
            "panel",
            undefined,
            "Opções"
        );

        optionsPanel.orientation = "column";
        optionsPanel.alignChildren = ["left", "top"];
        optionsPanel.margins = 10;

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
        orderRow.add(
            "statictext",
            undefined,
            "Ordem das layers:"
        );

        var ddOrder = orderRow.add(
            "dropdownlist",
            undefined,
            [
                "Top to Bottom",
                "Bottom to Top"
            ]
        );

        ddOrder.selection = 0;

        var btnApply = win.add(
            "button",
            undefined,
            "EXPLODIR TEXTO"
        );

        btnApply.preferredSize.height = 32;

        var status = win.add(
            "statictext",
            undefined,
            "Selecione uma ou mais camadas de texto."
        );

        status.alignment = ["fill", "top"];

        function modeFromIndex(idx) {
            if (idx === 1) return "words";
            if (idx === 2) return "lines";
            if (idx === 3) return "custom word";
            if (idx === 4) return "custom regular expression";
            return "characters";
        }

        function indexFromMode(mode) {
            if (mode === "words") return 1;
            if (mode === "lines") return 2;
            if (mode === "custom word") return 3;
            if (mode === "custom regular expression") return 4;
            return 0;
        }

        function refreshCustomState() {
            var idx = ddMode.selection
                ? ddMode.selection.index
                : 0;

            customGroup.enabled = idx >= 3;

            if (idx === 3) {
                customGroup.children[0].text = "Palavra:";
            } else if (idx === 4) {
                customGroup.children[0].text = "Regex:";
            } else {
                customGroup.children[0].text = "Valor:";
            }
        }

        ddMode.selection = indexFromMode(
            loadSetting("split", "characters")
        );

        txtCustom.text = loadSetting(
            "splitWord",
            ""
        );

        cbDelete.value =
            loadSetting("deleteOriginal", "false") === "true";

        cbRTL.value =
            loadSetting("rtlText", "false") === "true";

        ddOrder.selection =
            loadSetting(
                "layerOrder",
                "topToBottom"
            ) === "bottomToTop"
                ? 1
                : 0;

        refreshCustomState();

        ddMode.onChange = refreshCustomState;

        btnApply.onClick = function () {
            var mode = modeFromIndex(
                ddMode.selection
                    ? ddMode.selection.index
                    : 0
            );

            var custom = txtCustom.text;

            if (
                (mode === "custom word" ||
                 mode === "custom regular expression") &&
                custom === ""
            ) {
                alert(
                    mode === "custom word"
                        ? "Digite a palavra que deseja isolar."
                        : "Digite uma expressão regular."
                );
                return;
            }

            var opts = {
                split: mode,
                splitWord: custom,
                rtlText: cbRTL.value,
                deleteOriginal: cbDelete.value,
                layerOrder:
                    ddOrder.selection &&
                    ddOrder.selection.index === 1
                        ? "bottomToTop"
                        : "topToBottom",
                silent: false
            };

            saveSetting("split", opts.split);
            saveSetting("splitWord", opts.splitWord);
            saveSetting("rtlText", opts.rtlText);
            saveSetting("deleteOriginal", opts.deleteOriginal);
            saveSetting("layerOrder", opts.layerOrder);

            var result = explodeCore(opts);

            if (result && result.message) {
                status.text = result.message;
            }
        };

        win.layout.layout(true);

        win.onResizing =
        win.onResize = function () {
            this.layout.resize();
        };

        return win;
    }

    $.global.getExplodeMesmoAPI = function () {
        return {
            explode: explodeCore
        };
    };

    $.global.explodeMesmo = function (options) {
        return explodeCore(options || {});
    };

    $.global.explode = function (options) {
        return explodeCore(options || {});
    };

    var panel = buildUI(thisObj);

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
