import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const root = path.resolve(".work");
const input = path.join(root, "inputs", "OST-PPT-Template-Apr-2026.potx");
const out = path.join(root, "template-preview");
await fs.mkdir(out, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(input));
const snapshot = await presentation.inspect({
  kind: "deck,slide,textbox,shape,image,table,chart,layout",
  include: "id,slide,name,title,textPreview,bbox,rows,cols,alt,isPlaceholder,placeholders",
  maxChars: 50000,
});
await fs.writeFile(path.join(out, "inspect.ndjson"), snapshot.ndjson);
await fs.writeFile(path.join(out, "masters.json"), JSON.stringify(presentation.masters.items.map(m => ({id:m.id,name:m.name,placeholders:m.placeholders?.summary?.()})), null, 2));
await fs.writeFile(path.join(out, "layouts.json"), JSON.stringify(presentation.layouts.items.map(l => ({id:l.id,name:l.name,placeholders:l.placeholders?.summary?.()})), null, 2));

for (let i = 0; i < presentation.slides.items.length; i++) {
  const slide = presentation.slides.getItem(i);
  const png = await slide.export({ format: "png", scale: 1 });
  await fs.writeFile(path.join(out, `slide-${String(i+1).padStart(2,"0")}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(out, `slide-${String(i+1).padStart(2,"0")}.layout.json`), await layout.text());
}
const montage = await presentation.export({ format: "png", montage: true, scale: 0.5 });
await fs.writeFile(path.join(out, "montage.png"), new Uint8Array(await montage.arrayBuffer()));
console.log(JSON.stringify({slides:presentation.slides.items.length, masters:presentation.masters.items.length, layouts:presentation.layouts.items.length}, null, 2));
