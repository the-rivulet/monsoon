import { CORE, Result, ctx, nextUUID, roll } from "./globals/core.js";
import { Position, walkable, world } from "./map.js";
export class Slot {
    uuid;
    item;
    canStore(item) {
        if (this.item)
            return Result.err_full;
        return this.validate(item) ? Result.ok : Result.err_invalid;
    }
    store(item) {
        return item.equip(this);
    }
    owner;
    constructor(owner) {
        this.owner = owner;
        this.uuid = nextUUID();
    }
}
export class HandSlot extends Slot {
    id = `${CORE}.hand`;
    name = "hand";
    validate = (item) => true;
}
export var ItemSize;
(function (ItemSize) {
    ItemSize[ItemSize["small"] = 0] = "small";
    ItemSize[ItemSize["medium"] = 1] = "medium";
    ItemSize[ItemSize["large"] = 2] = "large";
})(ItemSize || (ItemSize = {}));
export var WeaponType;
(function (WeaponType) {
    WeaponType[WeaponType["none"] = 0] = "none";
    WeaponType[WeaponType["melee"] = 1] = "melee";
    WeaponType[WeaponType["ranged"] = 2] = "ranged";
    WeaponType[WeaponType["hybrid"] = 3] = "hybrid";
})(WeaponType || (WeaponType = {}));
export class Item {
    uuid;
    /** This creature's position in the world. */
    _pos;
    get pos() {
        return this._pos || this.slot.owner.pos;
    }
    set pos(value) {
        this._pos = value;
    }
    /** The slot where this item is stored, if any. */
    slot;
    constructor(x, y, r) {
        this.pos = new Position(x, y, r);
        if (!r.items.includes(this))
            r.items.push(this);
        this.uuid = nextUUID();
    }
    /** Get rid of this. */
    destroy() {
        this.pos.region.items.splice(this.pos.region.items.indexOf(this), 1);
        this.slot.item = undefined;
    }
    equip(slot) {
        if (slot.item)
            return Result.err_full;
        let canStore = slot.canStore(this);
        if (canStore != Result.ok)
            return canStore;
        slot.item = this;
        this.slot = slot;
        this.pos = undefined;
        return Result.ok;
    }
    unequip(dropAt) {
        dropAt ??= this.slot.owner.pos;
        if (!this.slot)
            return Result.err_empty;
        this.pos = dropAt;
        this.slot.item = undefined;
        this.slot = undefined;
        return Result.ok;
    }
    /** Cause the item to fall, if it is in the air. */
    fall() {
        if (this.slot)
            return;
        while (walkable(this.pos.plus(0, 1)))
            this.pos.y++;
    }
    /** Whether the item is destroyed after being thrown. */
    volatile = false;
    /** Called when the item hits a creature after being thrown. */
    impactCreature(me, hit) { }
    /** Called when the item hits a surface after being thrown. */
    impactSurface(me, hit) { }
}
export class MeleeWeapon extends Item {
}
export class Dagger extends Item {
    id = `${CORE}.dagger`;
    name = "Dagger";
    size = ItemSize.medium;
    description = `A sharpened piece of rebar equipped with a small handle.
  Its form factor allows it to be effective as both a thrown and melee weapon.`;
    render(x, y, tileSize) {
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(x + tileSize, y);
        ctx.lineTo(x, y + tileSize);
        ctx.stroke();
    }
    volatile = false;
    impactCreature(me, hit) {
        hit.hp.hurt(roll(2, 4) + me.skills.power);
    }
    strike(me, hit) {
        hit.hp.hurt(roll(2, 4) + me.skills.power);
    }
}
new Dagger(3, 0, world.outskirts);
