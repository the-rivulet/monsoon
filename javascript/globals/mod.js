import { VERSION } from "./core.js";
export function displayInfo(r) {
    let text = `<b>${r.name}</b> v${r.modVersion} by ${r.author}<br/>
  ID: ${r.id}<br/>
  target game version: ${r.gameVersion} (current: ${VERSION})<br/>
  ${r.description}`;
    if (r.dependencies.length)
        text += `<br/><br/>dependencies:<br/>
  <ul>${r.dependencies.map(x => `<li>${x.id} v${x.version}</li>`).join("")}</ul>`;
    return text;
}
