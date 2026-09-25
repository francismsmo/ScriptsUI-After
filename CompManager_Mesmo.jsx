/*
    CompManager_Mesmo.jsx
    MESMO TOOLS - Unified ScriptUI panel for Adobe After Effects.

    Tabs:
    - Comps: batch resize, FPS, duration and 3D renderer
    - Duplica: deep duplicate selected comps
    - Explode: split selected text layers
    - 3D: enable/disable 3D on selected comps and nested precomps
    - Expressions: persistent named expression favorites

    Expression favorites are stored locally in:
    Folder.userData/MesmoTools/expression_favorites.txt
*/

(function MesmoTools(thisObj) {

    var SCRIPT_NAME = "Mesmo Tools";
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
        return status;
    }

    function formatTimecode(seconds, fps) {
        if (seconds < 0) seconds = 0;

        var nominalFPS = Math.max(1, Math.round(fps));
        var totalFrames = Math.round(seconds * fps);

        var frames = totalFrames % nominalFPS;
        var totalSeconds = Math.floor(totalFrames / fps);
        var secs = totalSeconds % 60;
        var minsTotal = Math.floor(totalSeconds / 60);
        var mins = minsTotal % 60;
        var hours = Math.floor(minsTotal / 60);

        return hours + ":" + pad2(mins) + ":" + pad2(secs) + ":" + pad2(frames);
    }

    function parseTimecode(tc, fps) {
        tc = trimString(tc);

        var m = tc.match(/^(\d+):([0-5]\d):([0-5]\d):(\d{2,3})$/);
        if (!m) {
            throw new Error("Duração inválida. Use o formato 0:00:00:00.");
        }

        var h = parseInt(m[1], 10);
        var min = parseInt(m[2], 10);
        var sec = parseInt(m[3], 10);
        var fr = parseInt(m[4], 10);
        var nominalFPS = Math.max(1, Math.round(fps));

        if (fr >= nominalFPS) {
            throw new Error(
                "O campo de frames (" + fr + ") precisa ser menor que " +
                nominalFPS + " para " + fps + " fps."
            );
        }

        var duration = (h * 3600) + (min * 60) + sec + (fr / fps);

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
        tab.margins = 10;

        var header = tab.add("group");
        header.orientation = "row";
        header.alignChildren = ["fill", "center"];

        var selectionText = header.add("statictext", undefined, "Selecione comps no Project.");
        selectionText.alignment = ["fill", "center"];

        var btnLoad = header.add("button", undefined, "Ler 1ª Comp");

        var resizePanel = tab.add("panel", undefined, "Resize Comp");
        resizePanel.orientation = "column";
        resizePanel.alignChildren = ["fill", "top"];
        resizePanel.margins = 10;

        var cbResize = resizePanel.add("checkbox", undefined, "Aplicar Resize");

        var sizeRow = resizePanel.add("group");
        sizeRow.orientation = "row";
        sizeRow.alignChildren = ["left", "center"];

        sizeRow.add("statictext", undefined, "W:");
        var txtW = sizeRow.add("edittext", undefined, "1920");
        txtW.characters = 6;

        sizeRow.add("statictext", undefined, "H:");
        var txtH = sizeRow.add("edittext", undefined, "1080");
        txtH.characters = 6;

        sizeRow.add("statictext", undefined, "px");

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

        var fpsPanel = tab.add("panel", undefined, "Frame Rate");
        fpsPanel.orientation = "column";
        fpsPanel.alignChildren = ["fill", "top"];
        fpsPanel.margins = 10;

        var cbFPS = fpsPanel.add("checkbox", undefined, "Aplicar Frame Rate");

        var fpsRow = fpsPanel.add("group");
        fpsRow.orientation = "row";
        fpsRow.alignChildren = ["left", "center"];

        fpsRow.add("statictext", undefined, "FPS:");

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

        var durationPanel = tab.add("panel", undefined, "Duração");
        durationPanel.orientation = "column";
        durationPanel.alignChildren = ["fill", "top"];
        durationPanel.margins = 10;

        var cbDuration = durationPanel.add("checkbox", undefined, "Aplicar Duração");

        var durationRow = durationPanel.add("group");
        durationRow.orientation = "row";
        durationRow.alignChildren = ["left", "center"];

        durationRow.add("statictext", undefined, "Tempo:");
        var txtDuration = durationRow.add("edittext", undefined, "0:00:10:00");
        txtDuration.characters = 12;
        durationRow.add("statictext", undefined, "H:MM:SS:FF");

        var rendererPanel = tab.add("panel", undefined, "3D Renderer");
        rendererPanel.orientation = "column";
        rendererPanel.alignChildren = ["fill", "top"];
        rendererPanel.margins = 10;

        var cbRenderer = rendererPanel.add("checkbox", undefined, "Aplicar 3D Renderer");

        var rendererRow = rendererPanel.add("group");
        rendererRow.orientation = "row";
        rendererRow.alignChildren = ["left", "center"];
        rendererRow.add("statictext", undefined, "Renderer:");

        var ddRenderer = rendererRow.add(
            "dropdownlist",
            undefined,
            ["Classic 3D", "Advanced 3D", "Cinema 4D"]
        );
        ddRenderer.selection = 0;

        var btnApply = tab.add("button", undefined, "APLICAR NAS COMPS SELECIONADAS");
        btnApply.preferredSize.height = 34;

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
    }

    function buildDuplicaTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = 10;

        var pnlNaming = tab.add("panel", undefined, "New Item Naming");
        pnlNaming.orientation = "column";
        pnlNaming.alignChildren = ["fill", "top"];
        pnlNaming.margins = 10;

        var grpSfx = pnlNaming.add("group");
        var cbSfx = grpSfx.add("checkbox", undefined, "");
        cbSfx.value = true;

        var ddType = grpSfx.add("dropdownlist", undefined, ["Suffix", "Prefix"]);
        ddType.selection = 0;

        var txtSfx = grpSfx.add("edittext", undefined, "_Copy");
        txtSfx.characters = 16;

        var grpSrch = pnlNaming.add("group");
        var cbSrch = grpSrch.add("checkbox", undefined, "Search");

        var txtSrch = grpSrch.add("edittext", undefined, "");
        txtSrch.characters = 10;

        grpSrch.add("statictext", undefined, "Replace");

        var txtRpl = grpSrch.add("edittext", undefined, "");
        txtRpl.characters = 10;

        var pnlOpts = tab.add("panel", undefined, "Options");
        pnlOpts.orientation = "column";
        pnlOpts.alignChildren = ["fill", "top"];
        pnlOpts.margins = 10;

        var cbFolder = pnlOpts.add("checkbox", undefined, "Group Items Into Folder");

        var txtFolderName = pnlOpts.add("edittext", undefined, "Duplicated Comps");
        txtFolderName.enabled = false;

        var cbExp = pnlOpts.add("checkbox", undefined, "Update Expressions");
        cbExp.value = true;

        cbFolder.onClick = function () {
            txtFolderName.enabled = this.value;
        };

        var bottomGrp = tab.add("group");
        bottomGrp.orientation = "row";
        bottomGrp.alignment = ["fill", "top"];

        bottomGrp.add("statictext", undefined, "Copies:");

        var copyCount = bottomGrp.add("edittext", undefined, "1");
        copyCount.characters = 4;

        var btnRun = bottomGrp.add("button", undefined, "DUPLICATE SELECTED");
        btnRun.alignment = ["fill", "center"];

        var status = addStatus(tab, "Selecione uma ou mais comps no Project.");

        function processName(oldName) {
            var newName = oldName;

            if (cbSrch.value && txtSrch.text !== "") {
                newName = newName.split(txtSrch.text).join(txtRpl.text);
            }

            if (cbSfx.value) {
                if (ddType.selection && ddType.selection.index === 0) {
                    newName = newName + txtSfx.text;
                } else {
                    newName = txtSfx.text + newName;
                }
            }

            return newName;
        }

        function deepDupe(item, destFolder) {
            if (!(item instanceof CompItem)) return item;

            var newItem = item.duplicate();
            newItem.name = processName(item.name);

            if (destFolder) newItem.parentFolder = destFolder;

            for (var i = 1; i <= newItem.numLayers; i++) {
                var curLayer = newItem.layer(i);

                try {
                    if (curLayer.source instanceof CompItem) {
                        curLayer.replaceSource(
                            deepDupe(curLayer.source, destFolder),
                            cbExp.value
                        );
                    }
                } catch (e) {}
            }

            return newItem;
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
                alert("Copies precisa ser um número entre 1 e 999.");
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

            var targetFolder = null;
            var made = 0;

            try {
                if (cbFolder.value) {
                    targetFolder = app.project.items.addFolder(
                        txtFolderName.text || "Duplicated Comps"
                    );
                }

                for (i = 0; i < valid.length; i++) {
                    for (var c = 0; c < num; c++) {
                        deepDupe(valid[i], targetFolder);
                        made++;
                    }
                }
            } finally {
                app.endUndoGroup();
            }

            status.text = made + " cópia(s) principal(is) criada(s).";
        };
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

    function explodeSelectedText(opts) {
        var comp = app.project ? app.project.activeItem : null;

        if (!isComp(comp)) {
            alert("Abra uma composição e selecione uma ou mais camadas de texto.");
            return {pieces: 0, skipped: 0};
        }

        var selected = comp.selectedLayers;
        var textLayers = [];

        for (var i = 0; i < selected.length; i++) {
            if (isTextLayer(selected[i])) textLayers.push(selected[i]);
        }

        if (textLayers.length === 0) {
            alert("Nenhuma camada de texto selecionada.");
            return {pieces: 0, skipped: selected.length};
        }

        var totalPieces = 0;
        var skipped = 0;

        app.beginUndoGroup("Explode Mesmo");

        try {
            for (i = 0; i < textLayers.length; i++) {
                var layer = textLayers[i];
                var doc = getTextDocAtTime(layer, comp.time);
                var segments;

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

                try {
                    helper.name = "__EXPLODE_MESMO_MEASURE__";
                    helper.shy = true;
                } catch (e0) {}

                var created = [];

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
                    } catch (pieceErr) {}
                }

                try {
                    helper.remove();
                } catch (e1) {}

                reorderExplodedLayers(
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

        return {
            pieces: totalPieces,
            skipped: skipped
        };
    }

    function buildExplodeTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = 10;

        var splitPanel = tab.add("panel", undefined, "Split");
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
        ddMode.selection = 0;
        ddMode.alignment = ["fill", "center"];

        var customGroup = splitPanel.add("group");
        customGroup.orientation = "row";

        var customLabel = customGroup.add("statictext", undefined, "Valor:");

        var txtCustom = customGroup.add("edittext", undefined, "");
        txtCustom.characters = 24;
        txtCustom.alignment = ["fill", "center"];

        var optionsPanel = tab.add("panel", undefined, "Opções");
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
        orderRow.add("statictext", undefined, "Ordem das layers:");

        var ddOrder = orderRow.add(
            "dropdownlist",
            undefined,
            ["Top to Bottom", "Bottom to Top"]
        );
        ddOrder.selection = 0;

        var btnApply = tab.add("button", undefined, "EXPLODIR TEXTO");
        btnApply.preferredSize.height = 34;

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
                ".";
        };
    }

    function build3DTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = 10;

        var info = tab.add(
            "statictext",
            undefined,
            "Aplica o switch 3D nas camadas das comps selecionadas no Project."
        );
        info.alignment = ["fill", "top"];

        var optionsPanel = tab.add("panel", undefined, "Opções");
        optionsPanel.orientation = "column";
        optionsPanel.alignChildren = ["left", "top"];
        optionsPanel.margins = 10;

        var recursiveCheckbox = optionsPanel.add(
            "checkbox",
            undefined,
            "Processar Precomps"
        );
        recursiveCheckbox.value = true;

        var lockedCheckbox = optionsPanel.add(
            "checkbox",
            undefined,
            "Processar camadas bloqueadas"
        );
        lockedCheckbox.value = true;

        var btns = tab.add("group");
        btns.orientation = "row";
        btns.alignChildren = ["fill", "center"];

        var make3DButton = btns.add("button", undefined, "ATIVAR 3D");
        var disable3DButton = btns.add("button", undefined, "DESATIVAR 3D");

        var status = addStatus(tab, "Selecione comps no Project.");

        function processSelection(enable3D) {
            if (!app.project) {
                alert("Nenhum projeto aberto.");
                return;
            }

            var selection = app.project.selection;

            if (!selection || selection.length === 0) {
                alert("Selecione pelo menos uma composição no Project.");
                return;
            }

            var recursive = recursiveCheckbox.value;
            var processLocked = lockedCheckbox.value;
            var processed = [];
            var compCount = 0;
            var layerCount = 0;

            function alreadyProcessed(comp) {
                for (var i = 0; i < processed.length; i++) {
                    if (processed[i] === comp.id) return true;
                }
                return false;
            }

            function processComp(comp) {
                if (!(comp instanceof CompItem)) return;
                if (alreadyProcessed(comp)) return;

                processed.push(comp.id);
                compCount++;

                for (var i = 1; i <= comp.numLayers; i++) {
                    var layer = comp.layer(i);

                    try {
                        var wasLocked = layer.locked;

                        if (wasLocked && processLocked) layer.locked = false;

                        if (!layer.locked) {
                            try {
                                layer.threeDLayer = enable3D;
                                layerCount++;
                            } catch (e0) {}
                        }

                        if (wasLocked && processLocked) layer.locked = true;
                    } catch (e1) {}

                    if (recursive) {
                        try {
                            if (layer.source instanceof CompItem) {
                                processComp(layer.source);
                            }
                        } catch (e2) {}
                    }
                }
            }

            app.beginUndoGroup(
                enable3D ? "Ativar 3D" : "Desativar 3D"
            );

            try {
                for (var i = 0; i < selection.length; i++) {
                    if (selection[i] instanceof CompItem) {
                        processComp(selection[i]);
                    }
                }
            } finally {
                app.endUndoGroup();
            }

            status.text =
                compCount + " comps | " +
                layerCount + " camadas processadas.";
        }

        make3DButton.onClick = function () {
            processSelection(true);
        };

        disable3DButton.onClick = function () {
            processSelection(false);
        };
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
                e.toString().replace("Error: ", "")
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

    function buildExpressionsTab(tab) {
        tab.orientation = "column";
        tab.alignChildren = ["fill", "top"];
        tab.spacing = 8;
        tab.margins = 10;

        var favorites = loadExpressionFavorites();

        var searchRow = tab.add("group");
        searchRow.orientation = "row";
        searchRow.alignChildren = ["left", "center"];

        searchRow.add("statictext", undefined, "Buscar:");

        var txtSearch = searchRow.add("edittext", undefined, "");
        txtSearch.alignment = ["fill", "center"];
        txtSearch.characters = 22;

        var list = tab.add("listbox", undefined, [], {multiselect: false});
        list.alignment = ["fill", "fill"];
        list.preferredSize.height = 150;

        var nameRow = tab.add("group");
        nameRow.orientation = "row";
        nameRow.alignChildren = ["left", "center"];

        nameRow.add("statictext", undefined, "Nome:");

        var txtName = nameRow.add("edittext", undefined, "");
        txtName.alignment = ["fill", "center"];
        txtName.characters = 24;

        tab.add("statictext", undefined, "Expressão:");

        var txtCode = tab.add(
            "edittext",
            undefined,
            "",
            {
                multiline: true,
                scrolling: true,
                wantReturn: true
            }
        );
        txtCode.alignment = ["fill", "fill"];
        txtCode.preferredSize.height = 190;

        var manageRow = tab.add("group");
        manageRow.orientation = "row";
        manageRow.alignChildren = ["fill", "center"];

        var btnNew = manageRow.add("button", undefined, "Novo");
        var btnSave = manageRow.add("button", undefined, "Salvar");
        var btnDelete = manageRow.add("button", undefined, "Excluir");
        var btnCapture = manageRow.add("button", undefined, "Capturar");

        var applyRow = tab.add("group");
        applyRow.orientation = "row";
        applyRow.alignChildren = ["fill", "center"];

        var btnApply = applyRow.add(
            "button",
            undefined,
            "APLICAR NAS PROPRIEDADES SELECIONADAS"
        );
        btnApply.preferredSize.height = 34;

        var status = addStatus(
            tab,
            "Duplo clique em um favorito também aplica a expressão."
        );

        function refreshList(keepName) {
            var filter = trimString(txtSearch.text).toLowerCase();

            list.removeAll();

            for (var i = 0; i < favorites.length; i++) {
                var name = favorites[i].name;

                if (
                    filter === "" ||
                    name.toLowerCase().indexOf(filter) !== -1
                ) {
                    var item = list.add("item", name);

                    if (keepName && keepName === name) {
                        list.selection = item;
                    }
                }
            }
        }

        function loadSelectedFavorite() {
            if (!list.selection) return;

            var name = list.selection.text;
            var idx = findFavoriteIndex(favorites, name);

            if (idx !== -1) {
                txtName.text = favorites[idx].name;
                txtCode.text = favorites[idx].code;
                status.text = "Carregado: " + favorites[idx].name;
            }
        }

        function applyCurrentExpression() {
            var code = txtCode.text;

            if (trimString(code) === "") {
                alert("A expressão está vazia.");
                return;
            }

            var props = collectSelectedExpressionProperties();

            if (props.length === 0) {
                alert(
                    "Selecione uma ou mais propriedades que aceitem expressão."
                );
                return;
            }

            var applied = 0;
            var errors = [];

            app.beginUndoGroup("Mesmo Tools - Apply Expression");

            try {
                for (var i = 0; i < props.length; i++) {
                    try {
                        props[i].expression = code;
                        applied++;
                    } catch (e) {
                        var propName = "Property";
                        try { propName = props[i].name; } catch (nameErr) {}

                        errors.push(
                            propName + ": " +
                            e.toString().replace("Error: ", "")
                        );
                    }
                }
            } finally {
                app.endUndoGroup();
            }

            status.text =
                applied + " propriedade(s) atualizada(s)" +
                (errors.length ? " | " + errors.length + " erro(s)" : "") +
                ".";

            if (errors.length) {
                alert("Algumas propriedades falharam:\n\n" + errors.join("\n"));
            }
        }

        txtSearch.onChanging = function () {
            refreshList(null);
        };

        list.onChange = loadSelectedFavorite;

        list.onDoubleClick = function () {
            loadSelectedFavorite();
            applyCurrentExpression();
        };

        btnNew.onClick = function () {
            list.selection = null;
            txtName.text = "";
            txtCode.text = "";
            status.text = "Novo favorito.";
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

            var idx = findFavoriteIndex(favorites, name);

            if (idx === -1) {
                favorites.push({
                    name: name,
                    code: code
                });
            } else {
                favorites[idx].code = code;
            }

            if (saveExpressionFavorites(favorites)) {
                refreshList(name);
                status.text = "Favorito salvo: " + name;
            }
        };

        btnDelete.onClick = function () {
            var name = trimString(txtName.text);

            if (name === "" && list.selection) {
                name = list.selection.text;
            }

            var idx = findFavoriteIndex(favorites, name);

            if (idx === -1) {
                alert("Selecione um favorito para excluir.");
                return;
            }

            favorites.splice(idx, 1);

            if (saveExpressionFavorites(favorites)) {
                txtName.text = "";
                txtCode.text = "";
                refreshList(null);
                status.text = "Favorito excluído.";
            }
        };

        btnCapture.onClick = function () {
            var props = collectSelectedExpressionProperties();

            if (props.length === 0) {
                alert("Selecione uma propriedade com expressão.");
                return;
            }

            var captured = "";

            try {
                captured = props[0].expression;
            } catch (e) {}

            if (trimString(captured) === "") {
                alert("A primeira propriedade selecionada não tem expressão.");
                return;
            }

            txtCode.text = captured;

            if (trimString(txtName.text) === "") {
                try {
                    txtName.text = props[0].name;
                } catch (nameErr) {
                    txtName.text = "Expression";
                }
            }

            status.text = "Expressão capturada da propriedade selecionada.";
        };

        btnApply.onClick = applyCurrentExpression;

        refreshList(null);
    }

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window(
                "palette",
                SCRIPT_NAME,
                undefined,
                {resizeable: true}
            );

        win.orientation = "column";
        win.alignChildren = ["fill", "fill"];
        win.spacing = 8;
        win.margins = 8;

        var header = win.add("group");
        header.orientation = "row";
        header.alignChildren = ["fill", "center"];

        var title = header.add("statictext", undefined, "MESMO TOOLS");
        title.alignment = ["fill", "center"];

        header.add("statictext", undefined, "v1.0");

        var tabs = win.add("tabbedpanel");
        tabs.alignment = ["fill", "fill"];
        tabs.preferredSize = [470, 610];

        var tabComps = tabs.add("tab", undefined, "Comps");
        var tabDuplica = tabs.add("tab", undefined, "Duplica");
        var tabExplode = tabs.add("tab", undefined, "Explode");
        var tab3D = tabs.add("tab", undefined, "3D");
        var tabExpressions = tabs.add("tab", undefined, "Expressions");

        buildCompsTab(tabComps);
        buildDuplicaTab(tabDuplica);
        buildExplodeTab(tabExplode);
        build3DTab(tab3D);
        buildExpressionsTab(tabExpressions);

        tabs.selection = tabComps;

        win.layout.layout(true);

        win.onResizing =
        win.onResize = function () {
            this.layout.resize();
        };

        return win;
    }

    var panel = buildUI(thisObj);

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
