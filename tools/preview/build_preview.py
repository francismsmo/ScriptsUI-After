#!/usr/bin/env python3
"""Monta preview/MesmoTools_preview.html com o emulador e os dois .jsx embutidos."""
import pathlib, sys

here = pathlib.Path(__file__).resolve().parent
root = here.parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "MesmoTools_preview.html"

def esc(s):
    return s.replace("</script", "<\\/script")

page = (here / "page.html").read_text(encoding="utf-8")
page = page.replace("/*EMU*/", esc((here / "emu.js").read_text(encoding="utf-8")), 1)
page = page.replace("/*PT*/", esc((root / "MesmoTools.jsx").read_text(encoding="utf-8")), 1)
page = page.replace("/*EN*/", esc((root / "MesmoTools_EN.jsx").read_text(encoding="utf-8")), 1)
out.write_text(page, encoding="utf-8")
print("ok", out, len(page) // 1024, "KB")
