/*
    CompManager_Mesmo.jsx
    Batch composition settings manager for Adobe After Effects.
*/

(function CompManagerMesmo(thisObj) {

    var SCRIPT_NAME = "Comp Manager Mesmo";
    var suppressResizeSync = false;
    var lockedRatio = 16 / 9;

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

    function trimString(s) {
        return String(s).replace(/^\s+|\s+$/g, "");
    }

    function parseLocalizedNumber(s) {
        s = trimString(s).replace(",", ".");
        return parseFloat(s);
    }

    function isValidCustomFPSString(s) {
        s = trimString(s);
        return /^\d+([.,]\d{1,2})?$/.test(s);
    }

    function pad2(n) {
        n = Math.floor(Math.abs(n));
        return (n < 10 ? "0" : "") + n;
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
            candidates = [
                "ADBE Advanced 3d",
                "ADBE Classic 3d",
                "Classic 3D"
            ];
        } else if (friendlyName === "Advanced 3D") {
            candidates = [
                "ADBE Calder",
                "Advanced 3D"
            ];
        } else if (friendlyName === "Cinema 4D") {
            candidates = [
                "ADBE Ernst",
                "ADBE Cinema 4d",
                "Cinema 4D"
            ];
        }

        var i, j;

        for (i = 0; i < candidates.length; i++) {
            for (j = 0; j < available.length; j++) {
                if (available[j] === candidates[i]) return available[j];
            }
        }

        for (j = 0; j < available.length; j++) {
            var low = String(available[j]).toLowerCase();

            if (
                friendlyName === "Advanced 3D" &&
                low.indexOf("calder") !== -1
            ) {
                return available[j];
            }

            if (
                friendlyName === "Cinema 4D" &&
                (low.indexOf("ernst") !== -1 || low.indexOf("cinema") !== -1)
            ) {
                return available[j];
            }

            if (
                friendlyName === "Classic 3D" &&
                low.indexOf("classic") !== -1
            ) {
                return available[j];
            }
        }

        return null;
    }

    function rendererFriendlyName(internalName) {
        var s = String(internalName).toLowerCase();

        if (
            s === "adbe advanced 3d" ||
            s.indexOf("classic") !== -1
        ) {
            return "Classic 3D";
        }

        if (
            s === "adbe calder" ||
            (s.indexOf("advanced") !== -1 && s !== "adbe advanced 3d")
        ) {
            return "Advanced 3D";
        }

        if (
            s === "adbe ernst" ||
            s.indexOf("cinema") !== -1
        ) {
            return "Cinema 4D";
        }

        return null;
    }

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME, undefined, {resizeable: true});

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 12;

        var header = win.add("group");
        header.orientation = "row";
        header.alignChildren = ["fill", "center"];

        var title = header.add("statictext", undefined, "COMP MANAGER MESMO");
        title.alignment = ["fill", "center"];

        var btnLoad = header.add("button", undefined, "Ler 1ª Comp");

        var selectionText = win.add(
            "statictext",
            undefined,
            "Selecione composições no painel Project."
        );
        selectionText.alignment = ["fill", "top"];

        var resizePanel = win.add("panel", undefined, "Resize Comp");
        resizePanel.orientation = "column";
        resizePanel.alignChildren = ["fill", "top"];
        resizePanel.margins = 10;

        var cbResize = resizePanel.add("checkbox", undefined, "Aplicar Resize");
        cbResize.value = false;

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

        var cbLockRatio = resizePanel.add(
            "checkbox",
            undefined,
            "Lock aspect ratio"
        );
        cbLockRatio.value = true;

        function updateLockedRatioFromFields() {
            var w = parseInt(txtW.text, 10);
            var h = parseInt(txtH.text, 10);

            if (w > 0 && h > 0) {
                lockedRatio = w / h;
            }
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

        var fpsPanel = win.add("panel", undefined, "Frame Rate");
        fpsPanel.orientation = "column";
        fpsPanel.alignChildren = ["fill", "top"];
        fpsPanel.margins = 10;

        var cbFPS = fpsPanel.add("checkbox", undefined, "Aplicar Frame Rate");
        cbFPS.value = false;

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

            if (preset !== null) {
                txtCustomFPS.text = String(preset).replace(".", ",");
            }
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

        var durationPanel = win.add("panel", undefined, "Duração");
        durationPanel.orientation = "column";
        durationPanel.alignChildren = ["fill", "top"];
        durationPanel.margins = 10;

        var cbDuration = durationPanel.add(
            "checkbox",
            undefined,
            "Aplicar Duração"
        );
        cbDuration.value = false;

        var durationRow = durationPanel.add("group");
        durationRow.orientation = "row";
        durationRow.alignChildren = ["left", "center"];

        durationRow.add("statictext", undefined, "Tempo:");
        var txtDuration = durationRow.add("edittext", undefined, "0:00:10:00");
        txtDuration.characters = 12;
        durationRow.add("statictext", undefined, "H:MM:SS:FF");

        var rendererPanel = win.add("panel", undefined, "3D Renderer");
        rendererPanel.orientation = "column";
        rendererPanel.alignChildren = ["fill", "top"];
        rendererPanel.margins = 10;

        var cbRenderer = rendererPanel.add(
            "checkbox",
            undefined,
            "Aplicar 3D Renderer"
        );
        cbRenderer.value = false;

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

        var btnApply = win.add("button", undefined, "APLICAR NAS COMPS SELECIONADAS");
        btnApply.preferredSize.height = 34;

        var status = win.add(
            "statictext",
            undefined,
            "Nenhuma alteração aplicada ainda."
        );
        status.alignment = ["fill", "top"];

        function refreshSelectionText() {
            var comps = getSelectedComps();

            if (comps.length === 0) {
                selectionText.text = "Nenhuma composição selecionada no Project.";
            } else if (comps.length === 1) {
                selectionText.text = "1 composição selecionada: " + comps[0].name;
            } else {
                selectionText.text = comps.length + " composições selecionadas.";
            }
        }

        function setFPSUI(fps) {
            var eps = 0.001;

            if (Math.abs(fps - 23.976) < eps) {
                ddFPS.selection = 0;
                txtCustomFPS.text = "23,976";
                txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 24) < eps) {
                ddFPS.selection = 1;
                txtCustomFPS.text = "24";
                txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 29.97) < eps) {
                ddFPS.selection = 2;
                txtCustomFPS.text = "29,97";
                txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 30) < eps) {
                ddFPS.selection = 3;
                txtCustomFPS.text = "30";
                txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 59.94) < eps) {
                ddFPS.selection = 4;
                txtCustomFPS.text = "59,94";
                txtCustomFPS.enabled = false;
            } else if (Math.abs(fps - 60) < eps) {
                ddFPS.selection = 5;
                txtCustomFPS.text = "60";
                txtCustomFPS.enabled = false;
            } else {
                ddFPS.selection = 6;
                txtCustomFPS.text = String(
                    Math.round(fps * 100) / 100
                ).replace(".", ",");
                txtCustomFPS.enabled = true;
            }
        }

        function setRendererUI(comp) {
            var friendly = rendererFriendlyName(comp.renderer);

            if (friendly === "Classic 3D") {
                ddRenderer.selection = 0;
            } else if (friendly === "Advanced 3D") {
                ddRenderer.selection = 1;
            } else if (friendly === "Cinema 4D") {
                ddRenderer.selection = 2;
            }
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

            if (
                !cbResize.value &&
                !cbFPS.value &&
                !cbDuration.value &&
                !cbRenderer.value
            ) {
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
                    isNaN(newW) ||
                    isNaN(newH) ||
                    newW < 4 ||
                    newH < 4 ||
                    newW > 30000 ||
                    newH > 30000
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

            app.beginUndoGroup(SCRIPT_NAME);

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
                            var rendererInternal = findRenderer(
                                comp,
                                requestedRenderer
                            );

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
                    success +
                    " comp" +
                    (success === 1 ? "" : "s") +
                    " atualizada" +
                    (success === 1 ? "" : "s") +
                    " com sucesso.";
            } else {
                status.text =
                    success +
                    " atualizada(s), " +
                    errors.length +
                    " com erro.";

                alert(
                    "Processo concluído com alguns erros:\n\n" +
                    errors.join("\n")
                );
            }
        };

        win.addEventListener("mouseover", refreshSelectionText);

        refreshSelectionText();
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
