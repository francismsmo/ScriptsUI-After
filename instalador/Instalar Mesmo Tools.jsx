/*
    Instalador do Mesmo Tools (Mesmo Tools installer)

    Como usar / How to use:
      1. No After Effects: File > Scripts > Run Script File...
         (Arquivo > Scripts > Executar arquivo de script...)
      2. Escolha este arquivo. Ele precisa estar na mesma pasta que
         MesmoTools.jsx e MesmoTools_EN.jsx.
      3. Escolha o idioma e clique em Instalar. Depois reinicie o After.

    O que ele faz:
      - Copia o painel para a pasta "ScriptUI Panels" da versão do After
        que está aberta (2025, 2026, 2027...).
      - Se o Windows/macOS não deixar gravar na pasta do programa, instala
        na pasta de scripts do seu usuário, que o After também lê.
      - Liga "Allow Scripts to Write Files and Access Network", que o
        painel precisa para salvar curvas e expressões.
      - Apaga o CompManager_Mesmo.jsx antigo, se encontrar.
*/

(function () {
    var TITLE = "Instalar Mesmo Tools";
    var FILES = {pt: "MesmoTools.jsx", en: "MesmoTools_EN.jsx"};
    var OLD_FILES = ["CompManager_Mesmo.jsx"];
    var isWin = $.os.indexOf("Windows") !== -1;
    var here = new File($.fileName).parent;

    // ---------- arquivos de origem ----------

    // Procura o .jsx do painel ao lado do instalador (ou uma pasta acima).
    function source(name) {
        var tries = [here.fsName + "/" + name, here.parent ? here.parent.fsName + "/" + name : ""];
        for (var i = 0; i < tries.length; i++) {
            if (!tries[i]) continue;
            var f = new File(tries[i]);
            if (f.exists) return f;
        }
        return null;
    }

    function readVersion(f) {
        if (!f) return "";
        try {
            f.encoding = "UTF-8";
            if (!f.open("r")) return "";
            var txt = f.read(6000);
            f.close();
            var m = txt.match(/SCRIPT_VERSION\s*=\s*"([^"]+)"/);
            return m ? "v" + m[1] : "";
        } catch (e) {
            return "";
        }
    }

    // ---------- pastas de destino ----------

    var aeVersion = parseFloat(app.version);         // ex.: 27.0
    var aeVersionDir = aeVersion.toFixed(1);         // pasta de preferências: "27.0"

    // Pasta do programa: ...\Support Files\Scripts\ScriptUI Panels (Win)
    // ou /Applications/Adobe After Effects 20xx/Scripts/ScriptUI Panels (Mac).
    function appPanelsFolder() {
        try {
            var pkg = Folder.appPackage;
            if (!pkg) return null;
            var base = isWin ? pkg : pkg.parent;
            return new Folder(base.fsName + "/Scripts/ScriptUI Panels");
        } catch (e) {
            return null;
        }
    }

    // Pasta de scripts do usuário (não precisa de administrador).
    function userPanelsFolder() {
        var base = isWin
            ? Folder.userData.fsName + "/Adobe/After Effects/" + aeVersionDir
            : "~/Library/Preferences/Adobe/After Effects/" + aeVersionDir;
        return new Folder(base + "/Scripts/ScriptUI Panels");
    }

    function makeFolders(folder) {
        if (folder.exists) return true;
        if (folder.parent && !folder.parent.exists) makeFolders(folder.parent);
        return folder.create();
    }

    // Copia os arquivos; devolve "" se deu certo, ou o motivo do erro.
    function installInto(folder, sources) {
        try {
            if (!makeFolders(folder)) return "não foi possível criar a pasta";

            for (var i = 0; i < sources.length; i++) {
                var dest = new File(folder.fsName + "/" + sources[i].name);
                if (dest.exists && !dest.remove()) return "sem permissão para substituir " + sources[i].name;
                if (!sources[i].copy(dest.fsName)) return "sem permissão para gravar " + sources[i].name;
            }

            return "";
        } catch (e) {
            return e.toString();
        }
    }

    function removeFrom(folder, names) {
        var removed = 0;
        if (!folder || !folder.exists) return 0;

        for (var i = 0; i < names.length; i++) {
            var f = new File(folder.fsName + "/" + names[i]);
            try {
                if (f.exists && f.remove()) removed++;
            } catch (e) {}
        }

        return removed;
    }

    // ---------- permissão de gravar arquivos ----------

    function canWriteFiles() {
        try {
            return app.preferences.getPrefAsLong("Main Pref Section", "Pref_SCRIPTING_FILE_NETWORK_SECURITY") === 1;
        } catch (e) {
            return true; // versões antigas sem a preferência
        }
    }

    function enableWriteFiles() {
        if (canWriteFiles()) return true;

        try {
            app.preferences.savePrefAsLong("Main Pref Section", "Pref_SCRIPTING_FILE_NETWORK_SECURITY", 1);
            app.preferences.saveToDisk();
            app.preferences.reload();
        } catch (e) {}

        return canWriteFiles();
    }

    // ---------- janela ----------

    var srcPT = source(FILES.pt);
    var srcEN = source(FILES.en);

    if (!srcPT && !srcEN) {
        alert("Não achei o MesmoTools.jsx.\n\nDeixe o instalador na mesma pasta que MesmoTools.jsx e MesmoTools_EN.jsx e rode de novo.", TITLE);
        return;
    }

    var version = readVersion(srcPT || srcEN);

    var w = new Window("dialog", TITLE);
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];
    w.spacing = 10;
    w.margins = 16;

    var head = w.add("statictext", undefined, "Mesmo Tools " + version + "  →  After Effects " + app.version);
    try { head.graphics.font = ScriptUI.newFont(head.graphics.font.name, "BOLD", 13); } catch (eF) {}

    var langPanel = w.add("panel", undefined, "Idioma do painel / Panel language");
    langPanel.orientation = "column";
    langPanel.alignChildren = ["left", "top"];
    langPanel.margins = [12, 14, 12, 10];
    var rbPT = langPanel.add("radiobutton", undefined, "Português (MesmoTools.jsx)");
    var rbEN = langPanel.add("radiobutton", undefined, "English (MesmoTools_EN.jsx)");
    var rbBoth = langPanel.add("radiobutton", undefined, "Os dois / Both");
    rbPT.enabled = !!srcPT;
    rbEN.enabled = !!srcEN;
    rbBoth.enabled = !!(srcPT && srcEN);
    if (srcPT) rbPT.value = true; else rbEN.value = true;

    var cbOld = w.add("checkbox", undefined, "Apagar o CompManager_Mesmo.jsx antigo, se existir");
    cbOld.value = true;

    var appFolder = appPanelsFolder();
    var info = w.add("statictext", undefined,
        "Pasta: " + (appFolder ? appFolder.fsName : userPanelsFolder().fsName),
        {multiline: true});
    info.preferredSize = [420, 34];

    var btns = w.add("group");
    btns.alignment = ["right", "top"];
    var btnCancel = btns.add("button", undefined, "Cancelar", {name: "cancel"});
    var btnOk = btns.add("button", undefined, "Instalar", {name: "ok"});

    if (w.show() !== 1) return;

    var sources = [];
    if ((rbPT.value || rbBoth.value) && srcPT) sources.push(srcPT);
    if ((rbEN.value || rbBoth.value) && srcEN) sources.push(srcEN);

    // ---------- instalar ----------

    if (!enableWriteFiles()) {
        alert(
            "Antes de instalar, ligue esta opção e rode o instalador de novo:\n\n" +
            "Edit > Preferences > Scripting & Expressions >\n" +
            "\"Allow Scripts to Write Files and Access Network\"\n\n" +
            "(No Mac: After Effects > Settings > Scripting & Expressions)",
            TITLE
        );
        try { app.executeCommand(aeVersion >= 16.1 ? 3131 : 2359); } catch (eCmd) {}
        return;
    }

    var userFolder = userPanelsFolder();
    var target = null;
    var errApp = "";

    if (appFolder) {
        errApp = installInto(appFolder, sources);
        if (!errApp) target = appFolder;
    }

    if (!target) {
        var errUser = installInto(userFolder, sources);
        if (errUser) {
            alert(
                "Não consegui instalar.\n\n" +
                (appFolder ? "Pasta do programa: " + errApp + "\n" : "") +
                "Pasta do usuário: " + errUser + "\n\n" +
                "Use o instalador do sistema (Instalar Mesmo Tools - Windows.bat ou - Mac.command), " +
                "que pede permissão de administrador.",
                TITLE
            );
            return;
        }
        target = userFolder;
    }

    // Evita o painel aparecer duas vezes no menu Window.
    var names = [];
    for (var i = 0; i < sources.length; i++) names.push(sources[i].name);
    var other = target === appFolder ? userFolder : appFolder;
    var leftover = false;
    if (other && other.exists) {
        for (var k = 0; k < names.length; k++) {
            var dup = new File(other.fsName + "/" + names[k]);
            if (dup.exists && !dup.remove()) leftover = true;
        }
    }

    var oldRemoved = 0;
    if (cbOld.value) {
        oldRemoved += removeFrom(appFolder, OLD_FILES);
        oldRemoved += removeFrom(userFolder, OLD_FILES);
    }

    alert(
        "Mesmo Tools " + version + " instalado!\n\n" +
        "Pasta:\n" + target.fsName + "\n\n" +
        (oldRemoved ? "CompManager_Mesmo.jsx antigo apagado.\n\n" : "") +
        (leftover ? "Atenção: tem uma cópia antiga em\n" + other.fsName +
            "\nque eu não consegui apagar. Apague à mão para o painel não aparecer duas vezes.\n\n" : "") +
        "Reinicie o After Effects e abra em\nWindow > " + names.join(" / Window > "),
        TITLE
    );
})();
