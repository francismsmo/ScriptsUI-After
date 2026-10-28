# Mesmo Tools — histórico de versões

A versão aparece no canto do cabeçalho do painel (ex.: `v2.15`). Cada alteração sobe o número: 2.13 → 2.14 → 2.15...
A versão em inglês (`MesmoTools_EN.jsx`) tem sempre o mesmo número da portuguesa.

## v2.15 — 28/10/2026
- **Volta a aba Expressões**, em versão compacta:
  - dropdown de categoria + dropdown de expressão (no lugar da lista grande);
  - uma linha com "Aplicar em" e "Precisa de" (a descrição completa aparece ao passar o mouse);
  - campo de código menor;
  - Nova, Capturar, Salvar e Excluir em ícones; "Criar controles" e APLICAR na mesma linha.
- Os 18 atalhos com tutorial e as suas favoritas (★ Minhas) voltam como estavam.

## v2.14 — 28/10/2026
- **Interface mais compacta:** botões, dropdowns, campos e checkboxes mais baixos e com menos espaço entre eles; cabeçalho e abas mais justos.
- **Curvas:** o Clássico virou um modo ao lado do gráfico: **Clássico | Valor | Velocidade**, com ícones. Favoritar, salvar e excluir viraram ícones ao lado do dropdown.
- **Explode:** "Dividir" e "Opções" lado a lado.
- **Camadas:** Anchor Point e Extract juntos num bloco só, lado a lado. Criar virou uma linha de ícones (Texto, Adjustment, Null, Sólido, Shape, Câmera, Luz; o nome aparece ao passar o mouse). Batidas mais compacta.
- **3D / Blur:** opções numa linha só e botões de ícone Ligar/Desligar para 3D e Motion Blur.
- **Saiu:** o botão "Ler 1ª Comp" (e a aba Expressões, que voltou compacta na v2.15).

## v2.13 — 26/10/2026
- **Curvas > Clássico:** easy ease do After com influência ajustável, por keyframe (velocidade 0, como o F9).
  - **<** Entrada, **>** Saída e **×** Ambos, cada um com slider (0,1 a 100), campo numérico e botão de aplicar.
  - Aplica ao vivo enquanto arrasta o slider; o lado que você não mexe fica como estava.

## v2.12 — 21/10/2026
- **Curvas:** arrastar ficou mais leve. Cada trecho é preparado uma vez no clique, e no arraste só o ease é reaplicado (e só quando a curva muda).
- **Curvas:** passa a funcionar em paths de máscara e de shape e em outros parâmetros que aceitam ease. A velocidade média é lida do próprio After.
- Trechos encadeados (3 keys seguidas) não se sobrescrevem mais.

## v2.11 — 19/10/2026
- **Criar > Texto:** a primeira camada não vira mais "Texto 2".
- Mensagem de status corrigida na versão em inglês ("comps updated").
- Se algum botão der erro, o painel mostra a mensagem exata e a linha, em vez de não fazer nada.

## v2.10 — 19/10/2026
- **Versão em inglês:** `MesmoTools_EN.jsx`, gerada a partir da portuguesa por `tools/build_en.py`.
- **Null na Position:** só Position; basta selecionar as camadas. Com várias camadas, cria um único null que move todas.

## v2.09 — 16/10/2026
- **Novo painel Camadas:** Criar (Texto, Adjustment, Null, Sólido, Shape, Câmera, Luz), Null no atributo, Anchor Point 3×3, Extract de grupos de shape e marcadores nas Batidas do áudio.

## v2.08 — 16/10/2026
- **Curvas:** modo Velocidade (speed graph) no editor.
- Arrastar a alça para fora do editor solta o clique (não fica mais "preso").
- Campos de texto acompanham a largura do painel.
- Desempenho: recolher/expandir e trocar de aba recalculam só a aba aberta.

## v2.07 — 15/10/2026
- Barra de rolagem: o painel pode ficar pequeno e o conteúdo rola.

## v2.06 — 15/10/2026
- **Curvas:** biblioteca em dropdown e editor que aplica ao vivo; saíram Aplicar, Capturar, Importar/Exportar e Restaurar.

## v2.05 — 15/10/2026
- Cada aba mostra todas as suas ferramentas ao mesmo tempo (lado a lado ou empilhadas, botão ⇆), com cabeçalhos que recolhem/expandem.

## v2.04 — 15/10/2026
- Visual lilás, abas agrupadas, miniaturas de curva quadradas e menores.

## v2.03 — 15/10/2026
- **3D / Blur:** liga/desliga Motion Blur em todas as camadas possíveis (e a chave da comp).

## v2.02 — 15/10/2026
- Corrige o erro "Illegal use of reserved word" ao abrir o painel.
- **Expressões:** 18 atalhos do repositório After-effects-Expressions, com descrição e tutorial em comentário.

## v2.01 — 15/10/2026
- **Duplicar:** organiza em pasta da cópia + subpasta `PRECOMPS_<sufixo>`.

## v2.0 — 15/10/2026
- Tudo num arquivo só (`MesmoTools.jsx`), visual novo e aba Curvas.

## v1.1 — 15/10/2026
- Correções: timecode em 23,976/29,97/59,94, Duplicar sem precomps repetidas, Explode mais seguro, 3D ignora câmeras/luzes/áudio, aviso de erro de expressão.
