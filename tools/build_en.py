#!/usr/bin/env python3
"""
Gera MesmoTools_EN.jsx (versão em inglês) a partir de MesmoTools.jsx.

Como usar (na raiz do repositório):
    python3 tools/build_en.py

- Só troca textos de interface (strings) que estão na tabela TR, sempre o
  texto inteiro, para não mexer em nomes internos do After (matchNames etc.).
- A biblioteca de expressões é trocada pela versão em inglês de
  tools/i18n/expression_library_en.js.
- No fim, lista strings que parecem ter sobrado em português.

Sempre edite o MesmoTools.jsx (português) e rode este script de novo.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "MesmoTools.jsx")
DST = os.path.join(ROOT, "MesmoTools_EN.jsx")
LIB_EN = os.path.join(ROOT, "tools", "i18n", "expression_library_en.js")

HEADER_EN = '''/*
    MesmoTools_EN.jsx
    MESMO TOOLS - single ScriptUI panel for Adobe After Effects (English).

    GENERATED FILE: edit MesmoTools.jsx (Portuguese) and run
    tools/build_en.py to rebuild this file.
    Same version number as the Portuguese file (see SCRIPT_VERSION and
    CHANGELOG.md).

    Tabs:
    - Animation = Curves + Explode (on the same screen)
    - Layers = Create + Anchor Point + Extract + Beats
    - Comps = Settings + Duplicate + 3D / Blur (on the same screen)
    - Expressions: ready-made shortcuts + your favorite expressions

    Files saved in Folder.userData/MesmoTools/ (shared with the
    Portuguese version):
    - speed_curves.txt          (curves)
    - expression_favorites.txt  (expressions)
*/

'''

TR = {
    # ---- geral
    "Clique para recolher ou expandir": "Click to collapse or expand",
    "\\n\\nConfira em Preferências > Scripting & Expressions se a opção ": "\\n\\nCheck in Preferences > Scripting & Expressions that ",
    "\\\"Allow Scripts to Write Files and Access Network\\\" está ativada.": "\\\"Allow Scripts to Write Files and Access Network\\\" is enabled.",
    "Error: ": "Error: ",
    "Nenhum projeto aberto.": "No project open.",
    "Abra uma composição primeiro.": "Open a composition first.",
    "Selecione uma ou mais camadas.": "Select one or more layers.",

    # ---- comps / ajustes
    "Duração inválida. Use 0:00:00:00, segundos (10s) ou frames (250f).": "Invalid duration. Use 0:00:00:00, seconds (10s) or frames (250f).",
    "O campo de frames (": "The frames field (",
    ") precisa ser menor que ": ") must be less than ",
    " para ": " for ",
    "A duração precisa ser maior que zero.": "Duration must be greater than zero.",
    "O After Effects limita composições a 3 horas.": "After Effects limits compositions to 3 hours.",
    "Selecione comps no Project.": "Select comps in the Project panel.",
    "Ler 1ª Comp": "Read 1st Comp",
    "Carrega os valores da primeira comp selecionada": "Loads the values of the first selected comp",
    "Resolução": "Resolution",
    "Aplicar Resize": "Apply Resize",
    "Travar proporção": "Lock aspect ratio",
    "Aplicar Frame Rate": "Apply Frame Rate",
    "FPS custom inválido. Use um valor de 4 a 300 com até 2 casas decimais.": "Invalid custom FPS. Use a value from 4 to 300 with up to 2 decimals.",
    "O FPS precisa estar entre 4 e 300.": "FPS must be between 4 and 300.",
    "Duração": "Duration",
    "Aplicar Duração": "Apply Duration",
    "Tempo:": "Time:",
    "ou 10s / 250f": "or 10s / 250f",
    "Timecode H:MM:SS:FF, segundos (10s) ou frames (250f)": "Timecode H:MM:SS:FF, seconds (10s) or frames (250f)",
    "Renderer 3D": "3D Renderer",
    "Aplicar 3D Renderer": "Apply 3D Renderer",
    "APLICAR NAS COMPS SELECIONADAS": "APPLY TO SELECTED COMPS",
    "Nenhuma alteração aplicada ainda.": "No changes applied yet.",
    "Nenhuma composição selecionada.": "No composition selected.",
    " comps selecionadas.": " comps selected.",
    "Selecione pelo menos uma composição no painel Project.": "Select at least one composition in the Project panel.",
    "Valores carregados de: ": "Values loaded from: ",
    "Ative pelo menos uma opção para aplicar.": "Enable at least one option to apply.",
    "W e H precisam ser inteiros entre 4 e 30000 px.": "W and H must be whole numbers between 4 and 30000 px.",
    "O After Effects não aceitou ": "After Effects did not accept ",
    " fps nesta composição.": " fps in this composition.",
    " não está disponível nesta instalação do After Effects.": " is not available in this After Effects installation.",
    " comp atualizada.": " comp updated.",
    " comps atualizadas.": " comps updated.",
    " atualizada(s), ": " updated, ",
    " com erro.": " with errors.",
    "Processo concluído com alguns erros:\\n\\n": "Finished with some errors:\\n\\n",

    # ---- duplicar
    "Nome das cópias": "Copy names",
    "Sufixo": "Suffix",
    "Prefixo": "Prefix",
    "Buscar": "Search",
    "trocar por": "replace with",
    "Opções": "Options",
    "Organizar na pasta": "Organize in folder",
    "Vazio = usa o sufixo sem o \\\"_\\\" (ex.: _v02 vira v02)": "Empty = uses the suffix without the \\\"_\\\" (e.g. _v02 becomes v02)",
    "Separar as precomps numa subpasta PRECOMPS": "Put precomps in a PRECOMPS subfolder",
    "Separar as precomps numa subpasta ": "Put precomps in subfolder ",
    "Atualizar expressões": "Update expressions",
    "Cópias": "Copies",
    "Resultado: ": "Result: ",
    "  (na mesma pasta da original)": "  (same folder as the original)",
    "Resultado:  [": "Result:  [",
    "Cópias:": "Copies:",
    "DUPLICAR SELECIONADAS": "DUPLICATE SELECTED",
    "Selecione uma ou mais comps no Project.": "Select one or more comps in the Project panel.",
    "Selecione pelo menos uma composição no Project.": "Select at least one composition in the Project panel.",
    "Cópias precisa ser um número entre 1 e 999.": "Copies must be a number between 1 and 999.",
    "A seleção não contém composições.": "The selection has no compositions.",
    " comp(s) duplicada(s)": " comp(s) duplicated",
    " em \\\"": " in \\\"",

    # ---- explode
    "Informe uma expressão regular.": "Enter a regular expression.",
    "texto vertical não é suportado.": "vertical text is not supported.",
    "texto justificado não é suportado.": "justified text is not supported.",
    "Abra uma composição e selecione uma ou mais camadas de texto.": "Open a composition and select one or more text layers.",
    "Nenhuma camada de texto selecionada.": "No text layer selected.",
    "' foi ignorada: ": "' was skipped: ",
    "Erro em '": "Error in '",
    "Dividir": "Split",
    "Dividir em:": "Split into:",
    "Letras": "Characters",
    "Palavras": "Words",
    "Linhas": "Lines",
    "Palavra específica": "Specific word",
    "Expressão regular (regex)": "Regular expression (regex)",
    "Valor:": "Value:",
    "Excluir camada original": "Delete original layer",
    "Texto RTL (direita para esquerda)": "RTL text (right to left)",
    "Ordem das layers:": "Layer order:",
    "De cima para baixo": "Top to bottom",
    "De baixo para cima": "Bottom to top",
    "EXPLODIR TEXTO": "EXPLODE TEXT",
    "Selecione uma ou mais camadas de texto.": "Select one or more text layers.",
    "Palavra:": "Word:",
    "Digite a palavra que deseja isolar.": "Type the word you want to isolate.",
    "Digite uma expressão regular.": "Type a regular expression.",
    " layer(s) criada(s)": " layer(s) created",
    " ignorada(s)": " skipped",
    " peça(s) falharam": " piece(s) failed",
    "Algumas peças não puderam ser criadas, então ": "Some pieces could not be created, so ",
    " camada(s) original(is) foram mantidas para você não perder o texto.": " original layer(s) were kept so you don't lose the text.",

    # ---- 3D / blur
    "Comps selecionadas no Project (ou a comp aberta).": "Comps selected in the Project panel (or the open comp).",
    "Se nada estiver selecionado no Project, age na comp que está aberta.": "If nothing is selected in the Project panel, it acts on the open comp.",
    "Processar precomps": "Process precomps",
    "Processar camadas bloqueadas": "Process locked layers",
    "Camadas 3D": "3D Layers",
    "ATIVAR 3D": "ENABLE 3D",
    "DESATIVAR 3D": "DISABLE 3D",
    "Ligar a chave de Motion Blur da comp": "Also switch the comp's Motion Blur",
    "Sem a chave da comp ligada, o blur das camadas não aparece no preview nem no render.": "Without the comp switch on, layer blur shows in neither preview nor render.",
    "LIGAR MOTION BLUR": "MOTION BLUR ON",
    "DESLIGAR MOTION BLUR": "MOTION BLUR OFF",
    "Selecione pelo menos uma composição no Project (ou abra uma comp).": "Select at least one composition in the Project panel (or open a comp).",
    "Ligar ": "Enable ",
    "Desligar ": "Disable ",
    " ligado": " on",
    " desligado": " off",
    " camada(s) em ": " layer(s) in ",
    " | chave da comp ": " | comp switch ",
    "ligada": "on",
    "desligada": "off",
    " em ": " in ",

    # ---- expressões
    "Não foi possível abrir o arquivo de favoritos.": "Could not open the favorites file.",
    "Não foi possível salvar os favoritos:\\n": "Could not save favorites:\\n",
    "Todas": "All",
    "★ Minhas": "★ Mine",
    "Atalhos e favoritas": "Shortcuts and favorites",
    "Buscar por nome ou descrição": "Search by name or description",
    "Expressão": "Expression",
    "Aplicar em": "Apply to",
    "Nome:": "Name:",
    "Nova": "New",
    "Limpa o editor": "Clears the editor",
    "Salvar": "Save",
    "Salva nas suas favoritas (★ Minhas)": "Saves to your favorites (★ Mine)",
    "Excluir": "Delete",
    "Exclui uma das suas favoritas": "Deletes one of your favorites",
    "Capturar": "Capture",
    "Copia a expressão da propriedade selecionada": "Copies the expression from the selected property",
    "Aplicar": "Apply",
    "Criar Slider Control na camada se a expressão precisar": "Create the Slider Control on the layer if the expression needs it",
    "APLICAR NAS PROPRIEDADES SELECIONADAS": "APPLY TO SELECTED PROPERTIES",
    "Clique num atalho para ver o tutorial. Duplo clique aplica direto.": "Click a shortcut to see its tutorial. Double-click applies it.",
    "Expressão salva por você.": "Expression saved by you.",
    "Aplicar em: ": "Apply to: ",
    "   ·   Precisa de: ": "   ·   Needs: ",
    "Atalho: ": "Shortcut: ",
    "Favorita: ": "Favorite: ",
    "A expressão está vazia.": "The expression is empty.",
    "Selecione uma ou mais propriedades que aceitem expressão.": "Select one or more properties that accept expressions.",
    "Mesmo Tools - Expressão": "Mesmo Tools - Expression",
    "Propriedade": "Property",
    " propriedade(s) atualizada(s)": " propert(ies) updated",
    " Slider Control criado(s)": " Slider Control(s) created",
    " erro(s)": " error(s)",
    " com erro de expressão": " with expression errors",
    "Não foi possível aplicar em:\\n": "Could not apply to:\\n",
    "Aplicada, mas a expressão deu erro em:\\n": "Applied, but the expression has an error in:\\n",
    "\\n\\nConfira o tutorial no topo da expressão: às vezes falta ": "\\n\\nCheck the tutorial at the top of the expression: you may need to ",
    "renomear uma camada ou criar um controle.": "rename a layer or create a control.",
    "Nova expressão: escreva ou capture, dê um nome e salve.": "New expression: write or capture it, name it and save.",
    "Dê um nome para a expressão.": "Give the expression a name.",
    " (minha)": " (mine)",
    "Salva em ★ Minhas: ": "Saved to ★ Mine: ",
    "Os atalhos do Mesmo não podem ser excluídos. Só as suas favoritas (★ Minhas).": "Mesmo shortcuts can't be deleted. Only your favorites (★ Mine).",
    "Selecione uma das suas favoritas para excluir.": "Select one of your favorites to delete.",
    "Excluir a expressão \\\"": "Delete the expression \\\"",
    "Expressão excluída: ": "Expression deleted: ",
    "Selecione uma propriedade com expressão.": "Select a property with an expression.",
    "A primeira propriedade selecionada não tem expressão.": "The first selected property has no expression.",
    "Expressão capturada. Dê um nome e salve.": "Expression captured. Name it and save.",

    # ---- curvas
    "Básicas": "Basics",
    "Minhas": "Mine",
    "Não foi possível abrir o arquivo.": "Could not open the file.",
    "# Mesmo Tools speed curves v1 | nome<TAB>categoria<TAB>x1,y1,x2,y2<TAB>favorita": "# Mesmo Tools speed curves v1 | name<TAB>category<TAB>x1,y1,x2,y2<TAB>favorite",
    "Não foi possível salvar as curvas:\\n": "Could not save curves:\\n",
    "tipo de propriedade não suportado.": "unsupported property type.",
    "Escolha uma curva: ela já é aplicada nas keyframes selecionadas": "Pick a curve: it is applied to the selected keyframes right away",
    "Favoritar / desfavoritar (favoritas aparecem no topo)": "Favorite / unfavorite (favorites show at the top)",
    "Arraste as alças: as keyframes selecionadas mudam na hora. Shift arredonda.": "Drag the handles: selected keyframes update live. Shift rounds values.",
    "Gráfico:": "Graph:",
    "Valor": "Value",
    "Curva de valor (como o Value Graph)": "Value curve (like the Value Graph)",
    "Velocidade": "Speed",
    "Curva de velocidade (como o Speed Graph): alças = influência e speed": "Speed curve (like the Speed Graph): handles = influence and speed",
    "x1, y1, x2, y2 — pode colar do cubic-bezier.com. Enter aplica.": "x1, y1, x2, y2 — you can paste from cubic-bezier.com. Enter applies.",
    "Influência (%) e velocidade (× a velocidade média do trecho) de cada keyframe.": "Influence (%) and speed (× the segment's average speed) of each keyframe.",
    "Categoria:": "Category:",
    "Digite uma categoria existente ou crie uma nova": "Type an existing category or create a new one",
    "Salva na biblioteca (atualiza se o nome já existir)": "Saves to the library (updates if the name exists)",
    "Ao vivo nas keyframes selecionadas": "Live on selected keyframes",
    "Selecione keyframes e mexa no editor.": "Select keyframes and use the editor.",
    "Ao vivo desligado.": "Live is off.",
    "Selecione keyframes para ver a curva na timeline.": "Select keyframes to see the curve on the timeline.",
    "Ao vivo: ": "Live: ",
    " trecho(s)": " segment(s)",
    " falharam": " failed",
    " propriedade(s) não suportada(s)": " unsupported propert(ies)",
    "Mesmo Tools - Curva (arrastar)": "Mesmo Tools - Curve (drag)",
    "— curva personalizada —": "— custom curve —",
    "— escolha uma curva —": "— pick a curve —",
    "Saída ": "Out ",
    "Entrada ": "In ",
    "Mesmo Tools - Curva ": "Mesmo Tools - Curve ",
    "Use 4 números: x1, y1, x2, y2 (ex.: 0.4, 0, 0.2, 1).": "Use 4 numbers: x1, y1, x2, y2 (e.g. 0.4, 0, 0.2, 1).",
    "Mesmo Tools - Curva": "Mesmo Tools - Curve",
    "Dê um nome para a curva.": "Give the curve a name.",
    "Curva salva: ": "Curve saved: ",
    "Curva atualizada: ": "Curve updated: ",
    "Escolha (ou salve) uma curva da biblioteca primeiro.": "Pick (or save) a library curve first.",
    "Favoritada: ": "Favorited: ",
    "Desfavoritada: ": "Unfavorited: ",
    "Escolha uma curva da biblioteca para excluir.": "Pick a library curve to delete.",
    "Excluir a curva \\\"": "Delete the curve \\\"",
    "Curva excluída: ": "Curve deleted: ",

    # ---- curvas: clássico
    "Clássico": "Classic",
    "Entrada: influência do lado que chega em cada keyframe": "In: influence on the incoming side of each keyframe",
    "Saída: influência do lado que sai de cada keyframe": "Out: influence on the outgoing side of each keyframe",
    "Ambos: entrada e saída com a mesma influência": "Both: same influence on in and out",
    "Abra uma comp e selecione keyframes.": "Open a comp and select keyframes.",
    "Selecione keyframes para aplicar o ease clássico.": "Select keyframes to apply the classic ease.",
    "Mesmo Tools - Ease clássico": "Mesmo Tools - Classic ease",
    "Mesmo Tools - Ease clássico (arrastar)": "Mesmo Tools - Classic ease (drag)",
    "Entrada e saída ": "In and out ",
    "Clássico: ": "Classic: ",
    " keyframe(s).": " keyframe(s).",
    " (0,1 a 100)": " (0.1 to 100)",
    "Aplicar ": "Apply ",
    "na entrada": "to the in side",
    "na saída": "to the out side",
    "nos dois lados": "to both sides",
    " das keyframes selecionadas": " of the selected keyframes",

    # ---- camadas
    "Mesmo Tools - Criar camada": "Mesmo Tools - Create layer",
    "Texto": "Text",
    "Sólido": "Solid",
    "Câmera": "Camera",
    "Luz": "Light",
    "// Segue o null ": "// Follows the null ",
    "não é shape layer": "not a shape layer",
    "tem menos de 2 grupos": "has fewer than 2 groups",
    "Não achei o comando \\\"Convert Audio to Keyframes\\\" do After.": "Couldn't find After Effects' \\\"Convert Audio to Keyframes\\\" command.",
    "O After não criou a camada Audio Amplitude.": "After Effects did not create the Audio Amplitude layer.",
    "Camada de texto": "Text layer",
    "Adjustment Layer do tamanho da comp": "Comp-sized Adjustment Layer",
    "Sólido do tamanho da comp (escolha a cor)": "Comp-sized solid (pick a color)",
    "Shape Layer vazia": "Empty Shape Layer",
    "Câmera centralizada": "Centered camera",
    "Luz (Point) centralizada": "Centered (Point) light",
    "Criada: ": "Created: ",
    "NULL NA POSITION": "NULL TO POSITION",
    "Selecione uma ou mais camadas: cria um null no ponto delas e linka a Position ao null. Várias camadas = um único null que move todas.": "Select one or more layers: creates a null at their point and links Position to it. Several layers = one single null that moves them all.",
    "Clique para criar na comp aberta.": "Click to create in the open comp.",
    "Mesmo Tools - Null na position": "Mesmo Tools - Null to position",
    "Não foi possível criar o null:\\n": "Could not create the null:\\n",
    "Null criado: ": "Null created: ",
    " camadas)": " layers)",
    "Topo esquerdo": "Top left",
    "Topo": "Top",
    "Topo direito": "Top right",
    "Esquerda": "Left",
    "Centro": "Center",
    "Direita": "Right",
    "Base esquerda": "Bottom left",
    "Base": "Bottom",
    "Base direita": "Bottom right",
    "Anchor em \\\"": "Anchor at \\\"",
    "\\\" em ": "\\\" on ",
    " camada(s).": " layer(s).",
    "Move o Anchor Point para a quina, borda ou centro da camada sem tirá-la do lugar.": "Moves the Anchor Point to the corner, edge or center of the layer without moving it.",
    "Selecione camadas e clique num ponto.": "Select layers and click a point.",
    "Separa cada grupo da shape layer em uma camada.": "Splits each shape-layer group into its own layer.",
    "Cada grupo do Contents vira uma camada própria, na mesma posição.": "Each group in Contents becomes its own layer, in the same position.",
    "Centralizar o anchor de cada peça": "Center each piece's anchor",
    "Apagar a original (senão só esconde)": "Delete the original (otherwise just hide it)",
    "EXTRAIR FORMAS": "EXTRACT SHAPES",
    "Selecione shape layers com 2 ou mais grupos.": "Select shape layers with 2 or more groups.",
    "Selecione uma ou mais shape layers.": "Select one or more shape layers.",
    " camada(s) criada(s)": " layer(s) created",
    "Nada para extrair:\\n\\n": "Nothing to extract:\\n\\n",
    "Sensibilidade:": "Sensitivity:",
    "Mais alto = mais batidas (pega as mais fracas também)": "Higher = more beats (catches weaker ones too)",
    "Intervalo mínimo:": "Minimum gap:",
    "Apagar os marcadores antigos da camada": "Delete the layer's old markers",
    "Numerar os marcadores (1, 2, 3...)": "Number the markers (1, 2, 3...)",
    "MARCAR BATIDAS": "MARK BEATS",
    "Selecione uma camada com áudio.": "Select a layer with audio.",
    "Selecione uma camada de áudio (só uma).": "Select one audio layer (just one).",
    "A camada \\\"": "The layer \\\"",
    "\\\" não tem áudio.": "\\\" has no audio.",
    "Analisando o áudio...": "Analyzing audio...",
    "Mesmo Tools - Marcar batidas": "Mesmo Tools - Mark beats",
    "Não foi possível analisar.": "Could not analyze.",
    " batida(s) marcada(s) em \\\"": " beat(s) marked on \\\"",

    # ---- erros
    " — algo deu errado em \\\"": " — something went wrong in \\\"",
    "\\\":\\n\\n": "\\\":\\n\\n",
    "\\n(linha ": "\\n(line ",

    # ---- navegação
    "Animação": "Animation",
    "Curvas de velocidade + Explode de texto": "Speed curves + text Explode",
    "Curvas": "Curves",
    "Camadas": "Layers",
    "Criar camadas, null no atributo, anchor point, extract e batidas": "Create layers, null to position, anchor point, extract and beats",
    "Criar": "Create",
    "Batidas": "Beats",
    "Ajustes de comp + Duplicar + 3D / Motion Blur": "Comp settings + Duplicate + 3D / Motion Blur",
    "Ajustes": "Settings",
    "Duplicar": "Duplicate",
    "Expressões": "Expressions",
    "Atalhos de expressões e suas favoritas": "Expression shortcuts and your favorites",
    "Lado a lado": "Side by side",
    "Empilhado": "Stacked",
    "Disposição das ferramentas: ": "Tool layout: ",
    "\\n(clique para alternar: Auto → Lado a lado → Empilhado)": "\\n(click to cycle: Auto → Side by side → Stacked)",
}

# Nomes do After que NÃO podem ser traduzidos (procurados no After em PT).
KEEP = {
    "Ambos os canais",
    "Converter áudio em quadros-chave",
}

STRING_RE = re.compile(r'"((?:\\.|[^"\\\n])*)"')
PT_HINT = re.compile(
    r"[ãõáéíóúâêôçÃÕÁÉÍÓÚÂÊÔÇ]|\b(selecione|camada|camadas|curva|nenhum|nenhuma|aplicar|"
    r"salvar|excluir|nome|pasta|abra|composição|ligar|desligar|propriedade|valor|velocidade|"
    r"entrada|saída|criar|apagar|buscar|trocar|opções|todas|minhas|batidas|marcadores)\b",
    re.I,
)


def split_code_comments(text):
    """Divide o texto em pedaços [(é_código, trecho)] separando comentários."""
    out = []
    i = 0
    n = len(text)
    buf = []
    while i < n:
        c = text[i]
        if c == '"':
            # string: copia até fechar
            j = i + 1
            while j < n and text[j] != '"':
                if text[j] == "\\":
                    j += 1
                if text[j] == "\n":
                    break
                j += 1
            buf.append(text[i:j + 1])
            i = j + 1
            continue
        if text.startswith("/*", i):
            out.append((True, "".join(buf)))
            buf = []
            j = text.find("*/", i + 2)
            j = n if j == -1 else j + 2
            out.append((False, text[i:j]))
            i = j
            continue
        if text.startswith("//", i) and (i == 0 or text[i - 1] != ":"):
            out.append((True, "".join(buf)))
            buf = []
            j = text.find("\n", i)
            j = n if j == -1 else j
            out.append((False, text[i:j]))
            i = j
            continue
        buf.append(c)
        i += 1
    out.append((True, "".join(buf)))
    return out


def translate_code(code, used):
    def sub(m):
        s = m.group(1)
        if s in TR and s not in KEEP:
            used.add(s)
            return '"' + TR[s] + '"'
        return m.group(0)
    return STRING_RE.sub(sub, code)


def main():
    src = open(SRC, encoding="utf-8").read()

    # 1) cabeçalho em inglês
    start = src.index("(function MesmoTools(thisObj) {")
    body = src[start:]

    # 2) biblioteca de expressões em inglês
    lib_start = body.index("    var EXPRESSION_LIBRARY = [")
    lib_end = body.index("\n    ];\n", lib_start) + len("\n    ];\n")
    lib_en = open(LIB_EN, encoding="utf-8").read()
    if not lib_en.endswith("\n"):
        lib_en += "\n"
    # o comentário de abertura da biblioteca (logo acima) também vai em inglês
    comment_start = body.rfind("    // ================================================================\n    // BIBLIOTECA", 0, lib_start)
    if comment_start != -1:
        lib_start = comment_start
    body = body[:lib_start] + lib_en + body[lib_end:]

    # 3) strings da interface
    used = set()
    parts = split_code_comments(body)
    out = []
    for is_code, chunk in parts:
        out.append(translate_code(chunk, used) if is_code else chunk)
    result = HEADER_EN + "".join(out)

    open(DST, "w", encoding="utf-8").write(result)

    # 4) relatório: strings que ainda parecem português (fora da biblioteca)
    leftovers = []
    lib_s = result.index("    var EXPRESSION_LIBRARY = [")
    lib_e = result.index("\n    ];\n", lib_s)
    check = result[:lib_s] + result[lib_e:]
    for is_code, chunk in split_code_comments(check):
        if not is_code:
            continue
        for m in STRING_RE.finditer(chunk):
            s = m.group(1)
            if s in KEEP or s in TR.values():
                continue
            if PT_HINT.search(s) and s not in leftovers:
                leftovers.append(s)

    unused = sorted(set(TR) - used)
    print("MesmoTools_EN.jsx gerado: %d textos traduzidos." % len(used))
    if unused:
        print("Entradas da tabela que não apareceram no código (ok se o texto saiu):")
        for s in unused:
            print("   -", s)
    if leftovers:
        print("ATENÇÃO, possíveis textos em português sobrando:")
        for s in leftovers:
            print("   *", s)
        sys.exit(1)


if __name__ == "__main__":
    main()
