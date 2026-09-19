{
    app.beginUndoGroup("Alterar Resolução das Comps");

    var novaLargura = 1920;
    var novaAltura = 1080;

    var itens = app.project.selection;

    if (itens.length === 0) {
        alert("Selecione ao menos uma composição.");
    } else {

        for (var i = 0; i < itens.length; i++) {

            if (itens[i] instanceof CompItem) {

                itens[i].width = novaLargura;
                itens[i].height = novaAltura;

            }

        }

        alert("Resolução alterada com sucesso.");
    }

    app.endUndoGroup();
}