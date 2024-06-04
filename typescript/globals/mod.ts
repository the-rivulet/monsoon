import { VERSION } from "./core.js";

interface DependencyInfo {
  id: string;
  version: string;
}
export interface ModInfo {
  name: string;
  id: string;
  gameVersion: string;
  modVersion: string;
  author: string;
  description: string;
  dependencies?: DependencyInfo[];
}
export function displayInfo(r: ModInfo) {
  let text = `<b>${r.name}</b> v${r.modVersion} by ${r.author}<br/>
  ID: ${r.id}<br/>
  target game version: ${r.gameVersion} (current: ${VERSION})<br/>
  ${r.description}`;
  if(r.dependencies.length) text += `<br/><br/>dependencies:<br/>
  <ul>${r.dependencies.map(x => `<li>${x.id} v${x.version}</li>`).join("")}</ul>`;
  return text;
}
interface FileInfo {
  name: string;
  content: string;
}
export interface Mod {
  info: ModInfo;
  script?: string; // main.js
  files: FileInfo[]; // other files
}