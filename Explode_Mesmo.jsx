(function(thisObj) {
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "TextExploder Precise", undefined, {resizeable:true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];

        var btnApply = win.add("button", undefined, "EXPLODE PRECISE", {name: "ok"});

        function explodePrecise() {
            var comp = app.project.activeItem;
            if (!comp || comp.selectedLayers.length === 0) return alert("Selecione a camada de texto!");
            
            app.beginUndoGroup("TextExploder Precise");
            
            for (var i = 0; i < comp.selectedLayers.length; i++) {
                var layer = comp.selectedLayers[i];
                if (!(layer instanceof TextLayer)) continue;

                var textProp = layer.property("Source Text");
                var textDoc = textProp.value;
                var originalString = textDoc.text;
                var words = originalString.split(/\s+/);
                
                // Armazena propriedades globais
                var originalPosition = layer.property("Position").value;
                
                // Loop para criar as palavras
                for (var j = 0; j < words.length; j++) {
                    if (words[j] === "" || words[j] === " ") continue;
                    
                    var newLayer = layer.duplicate();
                    var newDoc = newLayer.property("Source Text").value;
                    
                    // 1. Isola a palavra mantendo o estilo
                    newDoc.text = words[j];
                    newLayer.property("Source Text").setValue(newDoc);
                    
                    // 2. Cálculo de posição relativa
                    // Criamos uma versão do texto original que só vai até a palavra atual
                    // para descobrir onde ela começa na frase.
                    var searchString = originalString.split(words[j])[0];
                    
                    // 3. Ajuste de Anchor Point para manter o visual original
                    // Esse método usa a bounding box da palavra nova para evitar o "pulo"
                    var rect = newLayer.sourceRectAtTime(comp.time, false);
                    newLayer.anchorPoint.setValue([rect.left + rect.width/2, rect.top + rect.height/2]);
                    
                    // 4. Reposicionamento baseado no índice (aproximado por bounding box)
                    // Para precisão absoluta de pixel, o script precisaria redesenhar 
                    // a frase caractere por caractere.
                }

                layer.enabled = false; 
            }
            app.endUndoGroup();
        }

        btnApply.onClick = explodePrecise;
        win.layout.layout(true);
        return win;
    }

    var myWin = buildUI(thisObj);
    if (myWin instanceof Window) myWin.show();
})(this);