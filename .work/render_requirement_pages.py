from pathlib import Path
import math
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
pdf = pdfium.PdfDocument(root / "inputs" / "ePTW-Requirements-Review.pdf")
out = root / "requirements-preview"
out.mkdir(parents=True, exist_ok=True)
pages = [5, 9, 12, 22, 37, 44, 59, 64, 71, 79, 86, 94, 95]
thumbs = []
for number in pages:
    image = pdf[number - 1].render(scale=1.4).to_pil().convert("RGB")
    path = out / f"page-{number:02d}.png"
    image.save(path)
    thumb = image.copy()
    thumb.thumbnail((360, 210))
    tile = Image.new("RGB", (380, 245), "white")
    tile.paste(thumb, ((380 - thumb.width) // 2, 25))
    ImageDraw.Draw(tile).text((10, 5), f"Page {number}", fill="black")
    thumbs.append(tile)

cols = 3
rows = math.ceil(len(thumbs) / cols)
sheet = Image.new("RGB", (cols * 380, rows * 245), (235, 238, 242))
for i, thumb in enumerate(thumbs):
    sheet.paste(thumb, ((i % cols) * 380, (i // cols) * 245))
sheet.save(out / "contact-sheet.png")
