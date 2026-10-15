# Mesmo Tools — painel ScriptUI para After Effects

Um painel só, com abas, para acelerar tarefas repetitivas no After Effects.

| Aba | O que faz |
|---|---|
| **Comps** | Muda em lote resolução (com trava de proporção), frame rate, duração e renderer 3D das comps selecionadas no Project. "Ler 1ª Comp" puxa os valores da primeira comp selecionada. |
| **Duplica** | Duplica comps "a fundo": as precomps internas também viram cópias independentes. Sufixo/prefixo, buscar e substituir no nome, pasta de destino e atualização de expressões. |
| **Explode** | Divide camadas de texto em caracteres, palavras, linhas, palavra específica ou regex, mantendo a posição visual de cada peça. |
| **3D** | Liga ou desliga o switch 3D em todas as camadas das comps selecionadas, opcionalmente entrando nas precomps e em camadas bloqueadas. |
| **Expressions** | Biblioteca de expressões favoritas: salvar, buscar, capturar de uma propriedade e aplicar nas propriedades selecionadas (duplo clique aplica direto). |

## Instalação

1. Copie `CompManager_Mesmo.jsx` para a pasta de painéis do After Effects:
   - **Windows:** `C:\Program Files\Adobe\Adobe After Effects <versão>\Support Files\Scripts\ScriptUI Panels\`
   - **macOS:** `/Applications/Adobe After Effects <versão>/Scripts/ScriptUI Panels/`
2. Reinicie o After Effects e abra pelo menu **Window → CompManager_Mesmo.jsx**.
3. Para a aba Expressions salvar favoritos, ative **Settings → Scripting & Expressions → Allow Scripts to Write Files and Access Network**.

Também funciona via **File → Scripts → Run Script File**, abrindo como janela flutuante.

Os favoritos ficam em `Folder.userData/MesmoTools/expression_favorites.txt` (no Windows, `%APPDATA%\MesmoTools\`).

## Dicas

- **Duração** aceita timecode (`0:00:10:00`), segundos (`10s`) ou frames (`250f`).
- **Explode** funciona melhor no After Effects 24.3+, que preserva estilos por caractere. Texto justificado e vertical não são suportados.
- Todas as ações entram num único Undo (Ctrl+Z desfaz a operação inteira).

## Pasta `legacy/`

Versões avulsas antigas, mantidas só como referência. Tudo o que elas fazem já está no Mesmo Tools:

- `AlterarResolucao_mesmo.jsx` → aba Comps
- `Duplica_Mesmo.jsx` → aba Duplica
- `Explode_Mesmo.jsx` → aba Explode (o avulso ainda expõe a API `explodeMesmo(options)` para outros scripts)
- `MakeEverything3D.jsx` → aba 3D
