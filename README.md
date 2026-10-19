# Mesmo Tools — painel ScriptUI para After Effects

Um painel só (`MesmoTools.jsx`) com tudo o que eu uso no dia a dia para acelerar o After Effects.

> **English:** `MesmoTools_EN.jsx` is the same panel with the whole interface (and the expression tutorials) in English. Install it the same way. See [English version](#english-version) below.

O painel tem 4 abas principais, e cada uma mostra **todas as suas ferramentas ao mesmo tempo**:

- **Animação** = Curvas + Explode
- **Camadas** = Criar + Anchor Point + Extract + Batidas
- **Comps** = Ajustes + Duplicar + 3D / Blur
- **Expressões**

Com o painel largo, as ferramentas ficam lado a lado em colunas; estreito, ficam empilhadas. O botão **⇆** ao lado das abas troca entre *Auto*, *Lado a lado* e *Empilhado*. Clicar no cabeçalho de uma ferramenta recolhe ou expande ela, e o painel lembra o que ficou recolhido.

A barra de rolagem à direita deixa você diminuir o painel o quanto quiser e ainda alcançar todos os botões. O cabeçalho e as abas ficam fixos no topo; a barra só fica ativa quando o conteúdo não cabe.

As cores ficam todas em `THEME`, no começo do arquivo (o destaque padrão é lilás).

| Ferramenta | O que faz |
|---|---|
| **Curvas** | Biblioteca de curvas de velocidade num dropdown (favoritas no topo, depois por categoria) e editor **ao vivo**, por valor ou por speed graph: escolher uma curva, arrastar as alças ou digitar os valores já muda as keyframes selecionadas na timeline. Salve, favorite e exclua suas curvas. |
| **Criar** | Botões para criar Texto, Adjustment Layer, Null, Sólido (com seletor de cor), Shape, Câmera e Luz na comp aberta, logo acima da camada selecionada. **Null na Position:** selecione uma ou mais camadas (não precisa abrir a Position) e ele cria um único null que controla a Position de todas. O nome segue `NomeDaCamada-position-null`. |
| **Anchor Point** | Grade 3×3: move o Anchor Point para uma quina, borda ou o centro das camadas selecionadas sem tirá-las do lugar. |
| **Extract** | Separa cada grupo de uma shape layer em uma camada própria, na mesma posição e ordem. Fills e strokes soltos no topo vão junto em cada peça. Pode centralizar o anchor de cada peça e apagar ou só esconder a original. |
| **Batidas** | Analisa o áudio da camada selecionada e cria um marcador em cada batida. Tem ajuste de sensibilidade, intervalo mínimo entre marcadores, opção de apagar os marcadores antigos e de numerar. |
| **Ajustes** | Muda em lote resolução (com trava de proporção), frame rate, duração e renderer 3D das comps selecionadas no Project. "Ler 1ª Comp" puxa os valores da primeira comp selecionada. |
| **Duplicar** | Duplica comps "a fundo": as precomps internas também viram cópias independentes. Sufixo/prefixo, buscar e trocar no nome e atualização de expressões. Organiza tudo numa pasta própria, com as precomps numa subpasta `PRECOMPS_<sufixo>`. |
| **Explode** | Divide camadas de texto em letras, palavras, linhas, palavra específica ou regex, mantendo a posição visual de cada peça. |
| **3D / Blur** | Liga ou desliga o switch 3D ou o **Motion Blur** em todas as camadas possíveis das comps selecionadas (ou da comp aberta), opcionalmente entrando nas precomps e em camadas bloqueadas. O Motion Blur também liga a chave da própria comp, para o blur aparecer no preview e no render. Câmeras, luzes, nulls e camadas só de áudio são ignoradas no blur. |
| **Expressões** | 18 atalhos prontos (delay, wiggle, texto, contadores, caixa reativa, 3D…), cada um com descrição, onde aplicar e tutorial em comentário. Também guarda suas próprias expressões (★ Minhas): salvar, buscar, capturar de uma propriedade e aplicar (duplo clique aplica direto). |

## Instalação

1. Copie `MesmoTools.jsx` para a pasta de painéis do After Effects:
   - **Windows:** `C:\Program Files\Adobe\Adobe After Effects <versão>\Support Files\Scripts\ScriptUI Panels\`
   - **macOS:** `/Applications/Adobe After Effects <versão>/Scripts/ScriptUI Panels/`
2. Se você tinha o `CompManager_Mesmo.jsx` instalado, apague ele da pasta (ele foi substituído).
3. Reinicie o After Effects e abra pelo menu **Window → MesmoTools.jsx**.
4. Para salvar curvas e expressões, ative **Preferências → Scripting & Expressions → Allow Scripts to Write Files and Access Network**.

## Curvas de velocidade

As curvas são guardadas como **cubic-bezier** (`x1, y1, x2, y2`), o mesmo formato do CSS e do [cubic-bezier.com](https://cubic-bezier.com). Dá para colar valores de lá direto no campo *Bezier*.

- **Selecione as keyframes** (duas ou mais vizinhas, em uma ou várias propriedades) e mexa no editor: a timeline atualiza na hora. Com uma keyframe só, a curva vai no trecho até a próxima.
- **Dropdown:** escolher uma curva já aplica.
- **Alças:** arraste para ajustar ao vivo; Shift arredonda os valores. Se o mouse sair do editor, a alça é solta ali.
- **Gráfico Valor / Velocidade:** *Valor* mostra a curva bezier; *Velocidade* mostra o speed graph, como no Graph Editor do After. Nele, cada alça é a influência (para os lados) e a velocidade da keyframe (para cima e para baixo). A linha tracejada é a velocidade média do trecho (1×).
- **Salvar / ★ / Excluir:** guarda a curva do editor com nome e categoria, marca como favorita (vai pro topo do dropdown) ou apaga.
- **Aplicar ao vivo:** desmarque se quiser só desenhar a curva sem mexer nas keys.
- Cada atualização entra no Undo; enquanto você arrasta, o After registra alguns passos por segundo.

Funciona em propriedades numéricas (posição, escala, rotação, opacidade, cor, efeitos…). Paths de máscara/shape e Source Text não são suportados.
Em **Position** com caminho espacial, curvas que passam do limite (tipo *Back*) não ultrapassam o ponto final. Para esse efeito, use **Separate Dimensions**.

## Atalhos de expressões

Vêm do repositório [After-effects-Expressions](https://github.com/francismsmo/After-effects-Expressions). Todo atalho abre com um bloco de comentário explicando **o que faz**, **onde aplicar**, **como usar** passo a passo e os cuidados. O comentário vai junto para a propriedade, então dá para reler o tutorial direto no After.

| Categoria | Atalhos |
|---|---|
| Delay | Delay do Control — Position / Rotation / Scale |
| Wiggle | Wiggle crescente, crescente com limite, diminuindo, em loop, na escala proporcional |
| Texto | Revelar texto letra por letra, Encadear APOIO depois do PRINCIPAL |
| Números | Contador 2 dígitos, Contador 6 dígitos (000.000), Timecode de câmera |
| Layout | Caixa reativa (Anchor Point do texto + Size da caixa), Tamanho por sliders |
| 3D | Escala constante pela câmera |
| Movimento | Desacelerar até parar |

- Quando a expressão usa um `Slider Control` na própria camada, o painel cria o efeito sozinho se ele não existir (dá para desligar).
- Os atalhos não podem ser apagados. Se você editar um e salvar, ele vira uma cópia sua em ★ Minhas.

## Camadas: detalhes

- **Null na Position** funciona só com a Position. Basta selecionar as camadas (ou a própria Position, se preferir).
  - **1 camada:** o null nasce exatamente no ponto da camada. Se a Position tiver keyframes, eles vão para o null (com os eases) e a camada passa a seguir o null.
  - **Várias camadas:** cria um único null no centro delas (nome `PrimeiraCamada+N-position-null`). Cada camada mantém a própria animação e soma o movimento do null, então mover o null move todas juntas.
  - Funciona com ou sem parent, em 2D e 3D, e com as dimensões da Position separadas.
- **Anchor Point** usa o tamanho da camada no tempo atual. A compensação da posição considera escala e rotação; em camadas 3D com rotação em X/Y ou Orientation, o resultado pode deslocar um pouco.
- **Batidas** usa o comando *Convert Audio to Keyframes* do próprio After para ler o volume, encontra os picos e depois apaga a camada temporária. Sensibilidade baixa pega só as batidas fortes; alta pega também as fracas. O intervalo mínimo evita marcadores grudados.

## Duplicar com pastas

Com **Organizar na pasta** e **Separar as precomps** ligados, duplicar a comp `Executar` com sufixo `_v02` gera:

```
📁 v02
   Executar_v02
   📁 PRECOMPS_v02
      (todas as precomps usadas dentro de Executar_v02)
```

- Deixando o nome da pasta vazio, ele usa o sufixo sem o `_` (`_v02` → `v02`).
- A pasta é criada ao lado da comp original.
- Com mais de uma cópia, cada uma ganha sua pasta numerada (`v02 1`, `v02 2`…).
- A linha "Resultado" mostra como vai ficar antes de duplicar, e o painel lembra suas escolhas.

## Dicas

- **Duração** aceita timecode (`0:00:10:00`), segundos (`10s`) ou frames (`250f`).
- **Explode** funciona melhor no After Effects 24.3+, que preserva estilos por caractere. Texto justificado e vertical não são suportados.
- Outros scripts e o KBar podem chamar `explodeMesmo({split: "words", deleteOriginal: true})` depois que o painel foi aberto uma vez.
- Todas as ações entram num único Undo (Ctrl+Z desfaz a operação inteira).
- O painel lembra a última aba aberta, a disposição escolhida e as ferramentas recolhidas.

Os arquivos salvos ficam em `Folder.userData/MesmoTools/` (no Windows, `%APPDATA%\MesmoTools\`).

## Pasta `legacy/`

Versões avulsas antigas, mantidas só como referência. Tudo o que elas fazem já está no Mesmo Tools.

## English version

`MesmoTools_EN.jsx` is generated from the Portuguese file, so both always have the same features:

```
python3 tools/i18n/exprlib_en.py   # English expression library (only if expressions changed)
python3 tools/build_en.py          # rebuilds MesmoTools_EN.jsx
```

- Always edit `MesmoTools.jsx`, then run `tools/build_en.py`. The UI translations live in the `TR` table inside that script; it fails and lists any Portuguese text left untranslated.
- Both versions share the same saved curves, favorite expressions and settings.
- Code comments inside the file stay in Portuguese; everything shown in After Effects is in English.
