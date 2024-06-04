import type { Creature } from "./creature.js";
import { CORE, Result, ctx, nextUUID, roll } from "./globals/core.js";
import { Position, Positioned, Region, Renderable, walkable, world } from "./map.js";

export interface InventoryOwner extends Positioned {
  inventory: Slot[];
}
export abstract class Slot {
  /** Should be unique to this slot and in the format `author.mod.slot`. */
  abstract id: string;
  uuid: number;
  abstract name: string;
  abstract validate: (item: Item) => boolean;
  item?: Item;
  canStore(item: Item) {
    if(this.item) return Result.err_full;
    return this.validate(item) ? Result.ok : Result.err_invalid;
  }
  store(item: Item) {
    return item.equip(this);
  }
  owner: InventoryOwner;
  constructor(owner: InventoryOwner) {
    this.owner = owner;
    this.uuid = nextUUID();
  }
}
export class HandSlot extends Slot {
  id = `${CORE}.hand`;
  name = "hand";
  validate = (item: Item) => true;
}
export enum ItemSize { small, medium, large }
export enum WeaponType { none, melee, ranged, hybrid }
export abstract class Item implements Renderable {
  /** Should be unique to this item and in the format `author.mod.item`. */
  abstract id: string;
  uuid: number;
  abstract name: string;
  /** How large this item is. */
  abstract size: ItemSize;
  /** A short description of this item. They are italicized in the Monsoon rulebook. */
  abstract description: string;
  /** This creature's position in the world. */
  private _pos: Position;
  get pos() {
    return this._pos || this.slot.owner.pos;
  }
  set pos(value: Position) {
    this._pos = value;
  }
  abstract render(x: number, y: number, tileSize: number): void;
  /** The slot where this item is stored, if any. */
  slot?: Slot;
  constructor(x: number, y: number, r: Region) {
    this.pos = new Position(x, y, r);
    if(!r.items.includes(this)) r.items.push(this);
    this.uuid = nextUUID();
  }
  /** Get rid of this. */
  destroy() {
    this.pos.region.items.splice(this.pos.region.items.indexOf(this), 1);
    this.slot.item = undefined;
  }
  equip(slot: Slot) {
    if(slot.item) return Result.err_full;
    let canStore = slot.canStore(this);
    if(canStore != Result.ok) return canStore;
    slot.item = this;
    this.slot = slot;
    this.pos = undefined;
    return Result.ok;
  }
  unequip(dropAt?: Position) {
    dropAt ??= this.slot.owner.pos;
    if(!this.slot) return Result.err_empty;
    this.pos = dropAt;
    this.slot.item = undefined;
    this.slot = undefined;
    return Result.ok;
  }
  /** Cause the item to fall, if it is in the air. */
  fall() {
    if(this.slot) return;
    while(walkable(this.pos.plus(0, 1))) this.pos.y++;
  }
  /** Whether the item is destroyed after being thrown. */
  volatile = false;
  /** Called when the item hits a creature after being thrown. */
  impactCreature(me: Creature, hit: Creature) {}
  /** Called when the item hits a surface after being thrown. */
  impactSurface(me: Creature, hit: Position) {}
}
export abstract class MeleeWeapon extends Item {
  /** Called when the item is used to attack a creature. */
  abstract strike(me: Creature, hit: Creature): void;
}
export class Dagger extends Item {
  id = `${CORE}.dagger`;
  name = "Dagger";
  size = ItemSize.medium;
  description = `A sharpened piece of rebar equipped with a small handle.
  Its form factor allows it to be effective as both a thrown and melee weapon.`;
  render(x: number, y: number, tileSize: number) {
    ctx.strokeStyle = "black";
    ctx.beginPath();
    ctx.moveTo(x + tileSize, y);
    ctx.lineTo(x, y + tileSize);
    ctx.stroke();
  }
  volatile = false;
  impactCreature(me: Creature, hit: Creature) {
    hit.hp.hurt(roll(2, 4) + me.skills.power);
  }
  strike(me: Creature, hit: Creature) {
    hit.hp.hurt(roll(2, 4) + me.skills.power);
  }
}

new Dagger(3, 0, world.outskirts);