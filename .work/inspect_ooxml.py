from collections import Counter
from pathlib import Path
from zipfile import ZipFile
from lxml import etree
import re

p = Path(__file__).resolve().parent / "inputs" / "OST-PPT-Template-Apr-2026.potx"
ns = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}
fonts = Counter()
colors = Counter()
with ZipFile(p) as z:
    pres = etree.fromstring(z.read("ppt/presentation.xml"))
    sld = pres.find("p:sldSz", ns)
    print("slide_size_emu", sld.get("cx"), sld.get("cy"))
    theme = etree.fromstring(z.read("ppt/theme/theme1.xml"))
    major = theme.find(".//a:themeElements/a:fontScheme/a:majorFont/a:latin", ns)
    minor = theme.find(".//a:themeElements/a:fontScheme/a:minorFont/a:latin", ns)
    print("theme_fonts", major.get("typeface"), minor.get("typeface"))
    for name in z.namelist():
        if name.endswith(".xml") and (name.startswith("ppt/slides/") or name.startswith("ppt/slideLayouts/") or name.startswith("ppt/slideMasters/")):
            raw = z.read(name)
            for m in re.finditer(rb'<a:(?:latin|ea|cs)[^>]*typeface="([^"]+)"', raw):
                fonts[m.group(1).decode("utf-8", "ignore")] += 1
            for m in re.finditer(rb'<a:srgbClr val="([0-9A-Fa-f]{6})"', raw):
                colors[m.group(1).decode().upper()] += 1
    print("fonts", fonts.most_common(20))
    print("colors", colors.most_common(20))
