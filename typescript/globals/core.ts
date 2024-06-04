/** NEVER EVER change this. */
export const CORE = "rivu.core";
/** The current version. */
export const VERSION = "0.1.0";

export function getId<Type extends HTMLElement>(x: string) {
  return document.getElementById(x) as Type;
}
export function log(x: string) {
  getId("log").insertAdjacentHTML("afterbegin", x + "<br/>");
}
export function roll(m: number, n: number) {
  let total = 0;
  for(let i = 0; i < m; i++) total += 1 + Math.floor(Math.random() * n);
  log(m + "d" + n + " = " + total);
  return total;
}
export let canvas = getId<HTMLCanvasElement>("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
export let ctx = canvas.getContext("2d");

let id = 0;
export let nextUUID = function() {
  id++; return id;
}

export enum Menu { main = "main", start = "start", event = "event", mods = "mods", map = "map" }
export let currentMenu = Menu.main;
/**
 * Changes the active menu to another one.
 * @param next The menu to switch to.
 */
export function switchMenu(next: Menu) {
  getId(`${next}menu`).style.top = "0";
  getId(`${currentMenu}menu`).style.top = "-100%";
  currentMenu = next;
}
/** Set up `onclick` handlers to switch between two menus. */
function registerLink(a: Menu, b: Menu) {
  getId(`${a}>${b}`).onclick = function() {
    switchMenu(b);
  };
  getId(`${b}>${a}`).onclick = function() {
    switchMenu(a);
  };
}
registerLink(Menu.main, Menu.mods);
registerLink(Menu.main, Menu.start);

/** The size that tiles should be rendered at. */
export const tileSize = 32;
/** Which keys are being pressed right now. */
export let keysDown = {};
document.onkeydown = function(e) {
  keysDown[e.key] = true;
}
document.onkeyup = function(e) {
  keysDown[e.key] = false;
}
/** Whether the mouse is down right now. */
export let mouseX = 0, mouseY = 0, scrX = 0, scrY = 0;
document.onmousemove = function(ev) {
  mouseX = ev.clientX;
  mouseY = ev.clientY;
  scrX = 0.25 * (mouseX - 0.5 * canvas.width);
  scrY = 0.25 * (mouseY - 0.5 * canvas.height);
  for(let i of Array.from(document.getElementsByClassName("tip")) as HTMLElement[]) {
    i.style.left = mouseX + 20 + "px";
    i.style.top = mouseY + 20 + "px";
  }
}
export function hoverPos(): Coordinates {
  return {
    x: Math.floor((mouseX + scrX - (0.5 * canvas.width)) / tileSize),
    y: Math.floor((mouseY + scrY - (0.5 * canvas.height)) / tileSize),
  };
}

export enum JumpStage { ascent, peak, descent }

export interface Coordinates {
  x: number;
  y: number;
}

export enum Result {
  /** The action was performed successfully. */
  ok,
  /** That will be refreshed next turn. */
  err_tired,
  /** You need empty space for that. */
  err_full,
  /** You need something more to do that. */
  err_empty,
  /** You need to get closer to that first. */
  err_too_far,
  /** You need line of sight to do that. */
  err_needs_sight,
  /** That isn't a valid target for that effect. */
  err_invalid
}