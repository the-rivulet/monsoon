import { CORE, getId } from "./globals/core.js";
import { OneHookable, EmptyHookable } from "./globals/hookable.js";
import { applyModHook } from "./modloader.js";
/** A test hook. Called when clicking on the test button in the main menu. */
export let testButtonHook = new OneHookable((ev) => {
    alert("Hello from orig! The mouse position is: (" + ev.clientX + ", " + ev.clientY + ")");
});
getId("testbutton").onclick = ev => testButtonHook.call(ev);
/** Another test hook. Sets the `textContent` of the test button in the main menu. */
export let buttonTextHook = new EmptyHookable(() => { return "test button :D"; });
applyModHook.hooks.push({ id: `${CORE}.buttonUpdate`, hook: orig => pack => {
        orig(pack);
        getId("testbutton").textContent = buttonTextHook.call();
    } });
