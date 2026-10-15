# Mesmo Tools — painel ScriptUI para After Effects

Um painel só (`MesmoTools.jsx`) com tudo o que eu uso no dia a dia para acelerar o After Effects.

| Aba | O que faz |
|---|---|
| **Curvas** | Biblioteca de curvas de velocidade. Salve suas curvas favoritas, organize por categoria, marque favoritas, edite arrastando as alças, capture a curva de keyframes que já existem e aplique com um clique. |
| **Comps** | Muda em lote resolução (com trava de proporção), frame rate, duração e renderer 3D das comps selecionadas no Project. "Ler 1ª Comp" puxa os valores da primeira comp selecionada. |
| **Duplicar** | Duplica comps "a fundo": as precomps internas também viram cópias independentes. Sufixo/prefixo, buscar e trocar no nome, pasta de destino e atualização de expressões. |
| **Explode** | Divide camadas de texto em letras, palavras, linhas, palavra específica ou regex, mantendo a posição visual de cada peça. |
| **3D** | Liga ou desliga o switch 3D em todas as camadas das comps selecionadas, opcionalmente entrando nas precomps e em camadas bloqueadas. |
| **Expressões** | Biblioteca de expressões favoritas: salvar, buscar, capturar de uma propriedade e aplicar nas propriedades selecionadas (duplo clique aplica direto). |

## Instalação

1. Copie `MesmoTools.jsx` para a pasta de painéis do After Effects:
   - **Windows:** `C:\Program Files\Adobe\Adobe After Effects <versão>\Support Files\Scripts\ScriptUI Panels\`
   - **macOS:** `/Applications/Adobe After Effects <versão>/Scripts/ScriptUI Panels/`
2. Se você tinha o `CompManager_Mesmo.jsx` instalado, apague ele da pasta (ele foi substituído).
3. Reinicie o After Effects e abra pelo menu **Window → MesmoTools.jsx**.
4. Para salvar curvas e expressões, ative **Preferências → Scripting & Expressions → Allow Scripts to Write Files and Access Network**.

## Curvas de velocidade

As curvas são guardadas como **cubic-bezier** (`x1, y1, x2, y2`), o mesmo formato do CSS e do [cubic-bezier.com](https://cubic-bezier.com). Dá para colar valores de lá direto no campo *Bezier*.

- **Aplicar:** selecione as keyframes (duas ou mais vizinhas, em uma ou várias propriedades) e clique em **APLICAR NAS KEYFRAMES**. Com uma keyframe só, a curva vai no trecho até a próxima.
- **Alt + clique** numa miniatura aplica a curva na hora.
- **Só saída / Só entrada:** aplica só o lado da curva que sai da 1ª key ou que chega na 2ª.
- **Capturar das keys:** lê a curva entre duas keyframes que você já ajustou no Graph Editor. Dê um nome e salve.
- **Organizar:** categorias (digite uma nova no campo *Categoria*), ★ favoritas, busca por nome e ◀ ▶ para mudar a ordem.
- **Importar / Exportar:** salva a biblioteca num `.txt` para backup ou para levar para outra máquina.
- **Restaurar padrões:** recoloca as 22 curvas que vêm com o painel sem apagar as suas.

Funciona em propriedades numéricas (posição, escala, rotação, opacidade, cor, efeitos…). Paths de máscara/shape e Source Text não são suportados.
Em **Position** com caminho espacial, curvas que passam do limite (tipo *Back*) não ultrapassam o ponto final. Para esse efeito, use **Separate Dimensions**.

## Dicas

- **Duração** aceita timecode (`0:00:10:00`), segundos (`10s`) ou frames (`250f`).
- **Explode** funciona melhor no After Effects 24.3+, que preserva estilos por caractere. Texto justificado e vertical não são suportados.
- Outros scripts e o KBar podem chamar `explodeMesmo({split: "words", deleteOriginal: true})` depois que o painel foi aberto uma vez.
- Todas as ações entram num único Undo (Ctrl+Z desfaz a operação inteira).
- O painel lembra a última aba aberta.

Os arquivos salvos ficam em `Folder.userData/MesmoTools/` (no Windows, `%APPDATA%\MesmoTools\`).

## Pasta `legacy/`

Versões avulsas antigas, mantidas só como referência. Tudo o que elas fazem já está no Mesmo Tools.
