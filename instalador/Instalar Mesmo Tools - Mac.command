#!/bin/bash
# ============================================================
#  Instalador do Mesmo Tools para macOS
#  Copia o painel para "ScriptUI Panels" de TODAS as versões
#  do After Effects em /Applications (2024, 2025, 2026, 2027, Beta...).
#  Se a pasta pedir permissão, ele pede a senha do Mac (sudo).
#
#  Se o macOS bloquear ao abrir: clique com o botão direito > Abrir.
# ============================================================

cd "$(dirname "$0")" || exit 1

SRCDIR="$(pwd)"
[ -f "$SRCDIR/MesmoTools.jsx" ] || SRCDIR="$(cd .. && pwd)"
if [ ! -f "$SRCDIR/MesmoTools.jsx" ]; then
    echo
    echo " Não achei o MesmoTools.jsx."
    echo " Deixe este instalador na mesma pasta que MesmoTools.jsx e MesmoTools_EN.jsx."
    echo
    read -n 1 -s -r -p " Aperte uma tecla para fechar..."
    exit 1
fi

echo
echo " ================================"
echo "      Instalar Mesmo Tools"
echo " ================================"
echo
echo "  1 = Português  (MesmoTools.jsx)"
echo "  2 = English    (MesmoTools_EN.jsx)"
echo "  3 = Os dois / Both"
echo
read -n 1 -r -p " Escolha o idioma [1, 2 ou 3]: " LANG_CHOICE
echo

case "$LANG_CHOICE" in
    2) FILES=("MesmoTools_EN.jsx") ;;
    3) FILES=("MesmoTools.jsx" "MesmoTools_EN.jsx") ;;
    *) FILES=("MesmoTools.jsx") ;;
esac

echo
FOUND=0
FAILED=0

run() {
    # roda direto; se não tiver permissão, usa sudo
    "$@" 2>/dev/null || sudo "$@"
}

shopt -s nullglob
for APPDIR in /Applications/Adobe\ After\ Effects*/; do
    APPDIR="${APPDIR%/}"
    [ -d "$APPDIR/Scripts" ] || continue
    DEST="$APPDIR/Scripts/ScriptUI Panels"
    OK=1
    run mkdir -p "$DEST" || OK=0
    for F in "${FILES[@]}"; do
        run cp -f "$SRCDIR/$F" "$DEST/$F" || OK=0
        xattr -d com.apple.quarantine "$DEST/$F" 2>/dev/null || sudo xattr -d com.apple.quarantine "$DEST/$F" 2>/dev/null
    done
    [ -f "$DEST/CompManager_Mesmo.jsx" ] && run rm -f "$DEST/CompManager_Mesmo.jsx"
    if [ $OK -eq 1 ]; then
        echo "  [OK]   $(basename "$APPDIR")"
        FOUND=$((FOUND + 1))
    else
        echo "  [ERRO] $(basename "$APPDIR")"
        FAILED=$((FAILED + 1))
    fi
done

echo
if [ $FOUND -eq 0 ] && [ $FAILED -eq 0 ]; then
    echo " Nenhum After Effects encontrado em /Applications."
    echo " Copie o MesmoTools.jsx à mão para:"
    echo " /Applications/Adobe After Effects 20xx/Scripts/ScriptUI Panels"
    echo
    read -n 1 -s -r -p " Aperte uma tecla para fechar..."
    exit 1
fi

echo " Pronto! Instalado em $FOUND versão(ões) do After Effects."
echo
echo " Falta só 1 coisa (uma vez só):"
echo "  After Effects > Settings > Scripting & Expressions >"
echo "  marque \"Allow Scripts to Write Files and Access Network\""
echo
echo " Depois reinicie o After e abra em Window > MesmoTools.jsx"
echo
read -n 1 -s -r -p " Aperte uma tecla para fechar..."
echo
