#!/usr/bin/env python3
"""Gera dist/MesmoTools-v<versão>.zip com o painel (PT e EN), os instaladores e um LEIA-ME."""
import pathlib, re, zipfile

root = pathlib.Path(__file__).resolve().parent.parent
pt = (root / "MesmoTools.jsx").read_text(encoding="utf-8")
version = re.search(r'SCRIPT_VERSION\s*=\s*"([^"]+)"', pt).group(1)
folder = f"MesmoTools v{version}"
out = root / "dist" / f"MesmoTools-v{version}.zip"
out.parent.mkdir(exist_ok=True)

leia = f"""Mesmo Tools v{version} - painel para After Effects (2024 a 2027)
=================================================================

INSTALAR (escolha um jeito)

1) Dentro do After Effects (Windows e Mac) - recomendado
   File > Scripts > Run Script File...
   escolha "Instalar Mesmo Tools.jsx" (desta pasta).
   Ele instala na versão aberta, deixa escolher o idioma e liga a
   permissão de gravar arquivos.

2) Windows: dois cliques em "Instalar Mesmo Tools - Windows.bat"
   (pede administrador; instala em todas as versões do After)

3) Mac: dois cliques em "Instalar Mesmo Tools - Mac.command"
   (se o macOS bloquear: botão direito > Abrir; pode pedir a senha)

Depois: reinicie o After e abra em Window > MesmoTools.jsx

Uma vez só: Edit > Preferences > Scripting & Expressions >
"Allow Scripts to Write Files and Access Network" (o instalador 1 já liga).

Manual: copie MesmoTools.jsx (ou MesmoTools_EN.jsx) para
  Windows: C:\\Program Files\\Adobe\\Adobe After Effects 20xx\\Support Files\\Scripts\\ScriptUI Panels
  Mac:     /Applications/Adobe After Effects 20xx/Scripts/ScriptUI Panels

-----------------------------------------------------------------
INSTALL (English): run "Instalar Mesmo Tools.jsx" from
File > Scripts > Run Script File... inside After Effects, or double-click
the .bat (Windows) / .command (Mac). Pick "English" to install
MesmoTools_EN.jsx. Restart After Effects and open Window > MesmoTools_EN.jsx.
"""

entries = [
    ("MesmoTools.jsx", root / "MesmoTools.jsx", 0o644),
    ("MesmoTools_EN.jsx", root / "MesmoTools_EN.jsx", 0o644),
    ("Instalar Mesmo Tools.jsx", root / "instalador" / "Instalar Mesmo Tools.jsx", 0o644),
    ("Instalar Mesmo Tools - Windows.bat", root / "instalador" / "Instalar Mesmo Tools - Windows.bat", 0o755),
    ("Instalar Mesmo Tools - Mac.command", root / "instalador" / "Instalar Mesmo Tools - Mac.command", 0o755),
]

with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name, src, mode in entries:
        info = zipfile.ZipInfo(f"{folder}/{name}", date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = (0o100000 | mode) << 16
        info.create_system = 3  # unix: guarda a permissão de executar do .command
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, src.read_bytes())
    info = zipfile.ZipInfo(f"{folder}/LEIA-ME.txt", date_time=(2026, 1, 1, 0, 0, 0))
    info.external_attr = (0o100644) << 16
    info.create_system = 3
    info.compress_type = zipfile.ZIP_DEFLATED
    z.writestr(info, leia.replace("\n", "\r\n").encode("utf-8"))

print("ok", out, out.stat().st_size // 1024, "KB")
