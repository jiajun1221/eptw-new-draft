import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
const p = await PresentationFile.importPptx(await FileBlob.load(path.resolve(".work/inputs/OST-PPT-Template-Apr-2026.potx")));
function methods(o) {
  const result = new Set();
  let x = o;
  while (x && x !== Object.prototype) {
    for (const k of Object.getOwnPropertyNames(x)) result.add(k);
    x = Object.getPrototypeOf(x);
  }
  return [...result].sort();
}
console.log("slides", methods(p.slides));
console.log("slide", methods(p.slides.getItem(0)));
console.log("layouts", p.layouts.items.map(x => ({name:x.name,id:x.id,methods:methods(x).slice(0,50)})));
console.log("count-before", p.slides.count, p.slides.items.length);
console.log("remove-return", p.slides.remove(0));
console.log("count-after", p.slides.count, p.slides.items.length);
