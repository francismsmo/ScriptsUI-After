(function MakeEverything3D(thisObj) {

    function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Make Everything 3D", undefined, {
                resizeable: true
            });

        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 8;
        panel.margins = 12;

        var title = panel.add("statictext", undefined, "MAKE EVERYTHING 3D");
        title.alignment = ["fill", "top"];

        var optionsPanel = panel.add("panel", undefined, "Opções");
        optionsPanel.orientation = "column";
        optionsPanel.alignChildren = ["left", "top"];
        optionsPanel.margins = 10;

        var recursiveCheckbox = optionsPanel.add("checkbox", undefined, "Processar Precomps");
        recursiveCheckbox.value = true;

        var lockedCheckbox = optionsPanel.add("checkbox", undefined, "Processar camadas bloqueadas");
        lockedCheckbox.value = true;

        var make3DButton = panel.add("button", undefined, "ATIVAR 3D");
        var disable3DButton = panel.add("button", undefined, "DESATIVAR 3D");

        var status = panel.add("statictext", undefined, "Selecione comps no Project.");
        status.alignment = ["fill", "top"];

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
                            } catch (e) {}
                        }

                        if (wasLocked && processLocked) layer.locked = true;
                    } catch (e) {}

                    if (recursive) {
                        try {
                            if (layer.source instanceof CompItem) {
                                processComp(layer.source);
                            }
                        } catch (e) {}
                    }
                }
            }

            app.beginUndoGroup(enable3D ? "Ativar 3D" : "Desativar 3D");

            for (var i = 0; i < selection.length; i++) {
                if (selection[i] instanceof CompItem) {
                    processComp(selection[i]);
                }
            }

            app.endUndoGroup();

            status.text = compCount + " comps | " + layerCount + " camadas processadas.";
        }

        make3DButton.onClick = function () {
            processSelection(true);
        };

        disable3DButton.onClick = function () {
            processSelection(false);
        };

        panel.layout.layout(true);

        panel.onResizing =
        panel.onResize = function () {
            this.layout.resize();
        };

        return panel;
    }

    var panel = buildUI(thisObj);

    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
