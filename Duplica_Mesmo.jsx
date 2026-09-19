{
    function duplicaMesmoPro(thisObj) {
        var myPanel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Duplica_mesmo Pro", undefined, {resizeable:true});
        
        myPanel.orientation = "column";
        myPanel.alignChildren = ["fill", "top"];
        myPanel.spacing = 10;
        myPanel.margins = 16;

        // --- GROUP: NAMING ---
        var pnlNaming = myPanel.add("panel", undefined, "New Item Naming");
        pnlNaming.orientation = "column";
        pnlNaming.alignChildren = ["fill", "top"];
        pnlNaming.margins = 15;

        var grpSfx = pnlNaming.add("group");
        var cbSfx = grpSfx.add("checkbox", undefined, "");
        cbSfx.value = true;
        var ddType = grpSfx.add("dropdownlist", undefined, ["Suffix", "Prefix"]);
        ddType.selection = 0;
        var txtSfx = grpSfx.add("edittext", undefined, "_Copy");
        txtSfx.preferredSize = [120, 20];

        var grpSrch = pnlNaming.add("group");
        var cbSrch = grpSrch.add("checkbox", undefined, "Search");
        var txtSrch = grpSrch.add("edittext", undefined, "");
        txtSrch.preferredSize = [70, 20];
        grpSrch.add("statictext", undefined, "Replace");
        var txtRpl = grpSrch.add("edittext", undefined, "");
        txtRpl.preferredSize = [70, 20];

        // --- GROUP: OPTIONS ---
        var pnlOpts = myPanel.add("panel", undefined, "Options");
        pnlOpts.orientation = "column";
        pnlOpts.alignChildren = ["fill", "top"];
        pnlOpts.margins = 15;

        var cbFolder = pnlOpts.add("checkbox", undefined, "Group Items Into Folder");
        var txtFolderName = pnlOpts.add("edittext", undefined, "Duplicated Comps");
        txtFolderName.enabled = false;
        var cbExp = pnlOpts.add("checkbox", undefined, "Update Expressions");
        cbExp.value = true;

        cbFolder.onClick = function() { txtFolderName.enabled = this.value; };

        // --- BOTTOM BAR ---
        var bottomGrp = myPanel.add("group");
        bottomGrp.alignment = "right";
        bottomGrp.add("statictext", undefined, "Copies:");
        var copyCount = bottomGrp.add("edittext", undefined, "1");
        copyCount.characters = 3;
        var btnRun = bottomGrp.add("button", undefined, "Duplicate Selected");

        // --- LOGIC ---
        function processName(oldName) {
            var newName = oldName;
            if (cbSrch.value && txtSrch.text !== "") {
                newName = newName.split(txtSrch.text).join(txtRpl.text);
            }
            if (cbSfx.value) {
                if (ddType.selection.index === 0) newName = newName + txtSfx.text;
                else newName = txtSfx.text + newName;
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
                if (curLayer.source instanceof CompItem) {
                    curLayer.replaceSource(deepDupe(curLayer.source, destFolder), false);
                }
            }
            return newItem;
        }

        btnRun.onClick = function() {
            var sel = app.project.selection;
            if (sel.length === 0) { alert("Selecione algo!"); return; }

            app.beginUndoGroup("Duplica_mesmo Execution");
            var targetFolder = null;
            if (cbFolder.value) targetFolder = app.project.items.addFolder(txtFolderName.text);

            for (var i = 0; i < sel.length; i++) {
                var num = parseInt(copyCount.text) || 1;
                for (var c = 0; c < num; c++) {
                    deepDupe(sel[i], targetFolder);
                }
            }
            app.endUndoGroup();
        };

        myPanel.layout.layout(true);
        if (myPanel instanceof Window) myPanel.show();
    }

    duplicaMesmoPro(this);
}