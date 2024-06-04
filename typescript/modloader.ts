import { satisfies } from "./slugver/satisfies.js";
import { SlugverRange } from "./slugver/range.js";
import { Slugcat, registerCharacter } from "./creature.js";
import { evaluate } from "./globals/evaluator.js";
import { CORE, VERSION, getId } from "./globals/core.js";
import { world } from "./map.js";
import { Hookable, EmptyHookable, OneHookable } from "./globals/hookable.js";
import { Mod, ModInfo, displayInfo } from "./globals/mod.js";

let loadedMods: Mod[] = [];
let appliedMods: Mod[] = [];

function unapplyAll() {
  // remove all added hooks
  for(let hookable of Hookable.all) {
    hookable.hooks = hookable.hooks.filter(x => x.id.startsWith(CORE)); // only keep "core" hooks
  }
}

getId("clearmods").onclick = function() {
  loadedMods = [];
  getId("loadedmods").textContent = "";
}

getId("fileloader").onclick = async function() {
  let directory = await window.showDirectoryPicker();
  let loadedMod: Mod = {info: undefined, files: []};
  let modInfoReader = new FileReader();
  let modInfoCallback = () => { try {
    let r = JSON.parse(modInfoReader.result.toString()) as ModInfo;
    if(!r) {
      alert("ERROR::LOADINFO::'import failure'");
    } if(!r.name || !r.id || !r.gameVersion || !r.modVersion || !r.author || !r.description) {
      alert("ERROR::'modinfo.json'::'required fields missing';'name, id, modVersion, gameVersion, author, description'");
    } else if(loadedMods.map(x => x.info.id).includes(r.id) || appliedMods.map(x => x.info.id).includes(r.id)) {
      alert("ERROR::LOADINFO::'mod already loaded';'" + r.id + "'");
    } else if(!satisfies(VERSION, new SlugverRange(r.gameVersion))) {
      alert("ERROR::LOADINFO::'target game version';'" + new SlugverRange(r.gameVersion).toString() + "';'incompatible with loaded version';'" + VERSION + "'");
    } else {
      //alert("NOTE::'modinfo.json'::'loaded'");
      if(!r.dependencies) r.dependencies = [];
      for(let dependency of r.dependencies) {
        let foundMod = loadedMods.find(x => x.info.id == dependency.id);
        let d = new SlugverRange(foundMod.info.modVersion);
        if(!foundMod) {
          alert("ERROR::'dependency missing';'" + dependency.id + "';'v" + dependency.version + "'");
          return;
        }
        else if(!satisfies(dependency.version, d)) {
          alert("ERROR::'dependency mismatch';'" + dependency.id + "';'v" + dependency.version + "';'incompatible with loaded version';'" + d + "'");
          return;
        }
      }
      if(r.dependencies.map(x => x.id).includes(r.id)) { // check for self-dependency (this shouldn't be a thing)
        alert("NOTE::'mod depends on itself';'continuing'");
        r.dependencies.splice(r.dependencies.map(x => x.id).indexOf(r.id), 1);
      }
      r.gameVersion = new SlugverRange(r.gameVersion).stringify();
      loadedMod.info = r;
      loadedMods.push(loadedMod);
      let modContainer = document.createElement("p");
      modContainer.id = "mod-" + r.id;
      let modInfo = document.createElement("span");
      modInfo.textContent = r.name + " ";
      modInfo.classList.add("tool");
      let modTip = document.createElement("div");
      modTip.innerHTML = displayInfo(r);
      modTip.classList.add("tip");
      modInfo.appendChild(modTip);
      modContainer.appendChild(modInfo);
      let clearMod = document.createElement("button");
      clearMod.textContent = "X";
      clearMod.onclick = function() {
        loadedMods.splice(loadedMods.indexOf(loadedMod), 1);
        getId("mod-" + r.id).remove();
        loadedMods.forEach(mod => {
          if(mod.info.dependencies.filter(x => x.id == r.id).length) { // if the mod depends on this one, remove it
            loadedMods.splice(loadedMods.indexOf(mod), 1);
            getId("mod-" + mod.info.id).remove();
          }
        });
      };
      clearMod.classList.add("managemod", "tool");
      let clearTip = document.createElement("div");
      clearTip.textContent = "remove " + r.name;
      clearTip.classList.add("tip");
      clearMod.appendChild(clearTip);
      modContainer.appendChild(clearMod);
      let moveUp = document.createElement("button");
      moveUp.textContent = "^";
      moveUp.onclick = function() {
        let modIndex = loadedMods.indexOf(loadedMod);
        if(modIndex == 0) {
          alert("ERROR::MOVEMOD::'already at top'");
          return;
        }
        let modAbove = loadedMods[modIndex - 1];
        if(r.dependencies.map(x => x.id).includes(modAbove.info.id)) {
          alert("ERROR::MOVEMOD::'dependency must be below dependent'");
          return;
        }
        // swap the positions of the mods in the dom
        modContainer.parentNode.insertBefore(getId("mod-" + modAbove.info.id), modContainer);
        // swap the mods in the mod list
        [loadedMods[modIndex], loadedMods[modIndex - 1]] = [loadedMods[modIndex - 1], loadedMods[modIndex]];
      };
      moveUp.classList.add("managemod", "tool");
      let moveTip = document.createElement("div");
      moveTip.textContent = "load " + r.name + " earlier";
      moveTip.classList.add("tip");
      moveUp.appendChild(moveTip);
      modContainer.appendChild(moveUp);
      getId("loadedmods").appendChild(modContainer);
    }
  } catch(e) { alert("ERROR::LOADINFO::'" + e + "'"); } };
  modInfoReader.addEventListener("load", modInfoCallback);
  // now read the files with the appropriate reader
  for await (let item of directory.values()) {
    if(item.kind == "file") {
      let file = await item.getFile();
      if(file.name == "modinfo.json" && file.type == "application/json") {
        if(file) modInfoReader.readAsText(file);
        else alert("ERROR::LOADFILES::'failed to load modinfo.json'");
      } else if(file.name == "main.js" && file.type == "text/javascript") {
        if(file) {
          // read it and put it in the script
          let jsReader = new FileReader();
          jsReader.addEventListener("load", (e) => {
            //alert("NOTE::'main.js'::'loaded'");
            loadedMod.script = jsReader.result.toString();
          });
          jsReader.readAsText(file);
        }
        else alert("ERROR::LOADFILES::'failed to load main.js'");
      } else {
        // put it in the other files
        if(file) {
          alert("NOTE::'" + file.name + "'::'loaded'");
          loadedMod.files.push({name: file.name, content: await file.text()});
        }
        else alert("ERROR::LOADFILES::'failed to load " + item.name + "'");
      }
    }
  }
};

export let registerCharactersHook = new EmptyHookable(() => {
  alert(world.outskirts.items);
  new Slugcat(0, 0, world.outskirts, "Nova");
});
// call this immediately
registerCharactersHook.call();

export let applyModHook = new OneHookable((pack: {old: Mod[], new: Mod[]}) => {
  alert("MODS LOADED! before=" + pack.old.length + " after=" + pack.new.length);
  getId("charselector").innerHTML = "";
  registerCharactersHook.call();
});

getId("applymods").onclick = async function() {
  let oldModList = appliedMods;
  try {
    unapplyAll();
    for(let index = 0; index < loadedMods.length; index++) {
      let mod = loadedMods[index];
      if(!mod.info) { // if a mod without info somehow got in here, get rid of it!
        loadedMods.splice(index, 1);
        index--;
        continue;
      }
      for(let dependency of mod.info.dependencies) {
        let success = false;
        let foundMod = loadedMods.slice(0, index).find(x => x.info.id == dependency.id);
        if(!foundMod) alert("ERROR::APPLYMODS::'" + mod.info.name + "';'dependency missing or misplaced';" + dependency.id + "';'v" + dependency.version + "'");
        else if(!satisfies(dependency.version, new SlugverRange(foundMod.info.modVersion))) alert("ERROR::APPLYMODS::'" + mod.info.name + "';'required version';'" +
          dependency.id + "';'v" + dependency.version + "';'incompatible with loaded version';'" + foundMod.info.modVersion + "'");
        else success = true;
        if(!success) {
          alert("NOTE::APPLYMODS::'operation aborted'");
          return;
        }
      }
      if(mod.script) {
        alert("NOTE::'" + mod.info.name + "'::'evaluating'");
        // this will be in a separate file to avoid the local bindings
        await evaluate(mod.script);
      } else alert("NOTE::'" + mod.info.name + "'::'no script'");
    }
    appliedMods = loadedMods;
    // show the newly applied mods
    getId("appliedmods").innerHTML = "";
    for(let r of appliedMods.map(x => x.info)) {
      let modContainer = document.createElement("p");
      modContainer.id = "mod-" + r.id;
      let modInfo = document.createElement("span");
      modInfo.textContent = r.name;
      modInfo.classList.add("tool");
      let modTip = document.createElement("div");
      modTip.innerHTML = displayInfo(r);
      modTip.classList.add("tip");
      modInfo.appendChild(modTip);
      modContainer.appendChild(modInfo);
      getId("appliedmods").appendChild(modContainer);
    }
  } catch(e) { alert("ERROR::APPLYMODS::'" + e + "'"); } finally {
    setTimeout(() => { applyModHook.call({old: oldModList, new: appliedMods}); }, 50);
  }
};

alert("NOTE::'main.ts'::'loaded successfully'");