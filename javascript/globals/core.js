/** NEVER EVER change this. */
export const CORE = "rivu.core";
/** The current version. */
export const VERSION = "0.1.0";
export function getId(x) {
    return document.getElementById(x);
}
export function log(x) {
    getId("log").insertAdjacentHTML("afterbegin", x + "<br/>");
}
export function roll(m, n) {
    let total = 0;
    for (let i = 0; i < m; i++)
        total += 1 + Math.floor(Math.random() * n);
    log(m + "d" + n + " = " + total);
    return total;
}
export let canvas = getId("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
export let ctx = canvas.getContext("2d");
let id = 0;
export let nextUUID = function () {
    id++;
    return id;
};
export var Menu;
(function (Menu) {
    Menu["main"] = "main";
    Menu["start"] = "start";
    Menu["event"] = "event";
    Menu["mods"] = "mods";
    Menu["map"] = "map";
})(Menu || (Menu = {}));
export let currentMenu = Menu.main;
/**
 * Changes the active menu to another one.
 * @param next The menu to switch to.
 */
export function switchMenu(next) {
    getId(`${next}menu`).style.top = "0";
    getId(`${currentMenu}menu`).style.top = "-100%";
    currentMenu = next;
}
/** Set up `onclick` handlers to switch between two menus. */
function registerLink(a, b) {
    getId(`${a}>${b}`).onclick = function () {
        switchMenu(b);
    };
    getId(`${b}>${a}`).onclick = function () {
        switchMenu(a);
    };
}
registerLink(Menu.main, Menu.mods);
registerLink(Menu.main, Menu.start);
/** The size that tiles should be rendered at. */
export const tileSize = 32;
/** Which keys are being pressed right now. */
export let keysDown = {};
document.onkeydown = function (e) {
    keysDown[e.key] = true;
};
document.onkeyup = function (e) {
    keysDown[e.key] = false;
};
/** Whether the mouse is down right now. */
export let mouseX = 0, mouseY = 0, scrX = 0, scrY = 0;
document.onmousemove = function (ev) {
    mouseX = ev.clientX;
    mouseY = ev.clientY;
    scrX = 0.25 * (mouseX - 0.5 * canvas.width);
    scrY = 0.25 * (mouseY - 0.5 * canvas.height);
    for (let i of Array.from(document.getElementsByClassName("tip"))) {
        i.style.left = mouseX + 20 + "px";
        i.style.top = mouseY + 20 + "px";
    }
};
export function hoverPos() {
    return {
        x: Math.floor((mouseX + scrX - (0.5 * canvas.width)) / tileSize),
        y: Math.floor((mouseY + scrY - (0.5 * canvas.height)) / tileSize),
    };
}
export var JumpStage;
(function (JumpStage) {
    JumpStage[JumpStage["ascent"] = 0] = "ascent";
    JumpStage[JumpStage["peak"] = 1] = "peak";
    JumpStage[JumpStage["descent"] = 2] = "descent";
})(JumpStage || (JumpStage = {}));
export var Result;
(function (Result) {
    /** The action was performed successfully. */
    Result[Result["ok"] = 0] = "ok";
    /** That will be refreshed next turn. */
    Result[Result["err_tired"] = 1] = "err_tired";
    /** You need empty space for that. */
    Result[Result["err_full"] = 2] = "err_full";
    /** You need something more to do that. */
    Result[Result["err_empty"] = 3] = "err_empty";
    /** You need to get closer to that first. */
    Result[Result["err_too_far"] = 4] = "err_too_far";
    /** You need line of sight to do that. */
    Result[Result["err_needs_sight"] = 5] = "err_needs_sight";
    /** That isn't a valid target for that effect. */
    Result[Result["err_invalid"] = 6] = "err_invalid";
})(Result || (Result = {}));
