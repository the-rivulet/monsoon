import { OneHookable } from "./hookable.js";
export let hurtHook = new OneHookable((pack) => {
    pack.hp.cur -= pack.amount;
    pack.hp.owner.destroy();
});
export let healHook = new OneHookable((pack) => {
    pack.hp.cur += pack.amount;
});
export let setMaxHook = new OneHookable((pack) => {
    pack.hp.max = pack.amount;
});
/** Represents a pool of hit points. */
export class HitPoints {
    /** The `Creature` that owns this pool. */
    owner;
    _cur;
    /** The current HP of this pool. Limited by the max HP. */
    set cur(value) {
        this._cur = Math.max(0, value);
        if (this.max < this.cur)
            this.cur = this.max;
    }
    get cur() { return this._cur; }
    _max;
    /** The maximum HP of this pool. */
    set max(value) {
        this._max = Math.max(0, value);
        if (this.max < this.cur)
            this.cur = this.max;
    }
    get max() { return this._max; }
    /**
     * Creates a new `HitPoints` object.
     * @param uuid The UUID of the object that owns this pool.
     * @param max The maximum HP of this pool.
     * @param cur The starting HP of this pool. Defaults to `max`.
     */
    constructor(owner, cur) {
        this.owner = owner;
        let max = owner.baseHp;
        this.cur = (cur ? Math.min(cur, max) : max);
        this.max = max;
    }
    /**
     * Deal damage to this hit point pool.
     * @param amount The amount of damage to be dealt.
     */
    hurt(amount) {
        hurtHook.call({ hp: this, amount: amount });
    }
    /**
     * Heal damage damage this hit point pool.
     * @param amount The amount of damage to be healed.
     */
    heal(amount) {
        healHook.call({ hp: this, amount: amount });
    }
    /**
     * Set the maximum HP of this hit point pool.
     * @param amount The new maximum HP.
     */
    setMax(amount) {
        setMaxHook.call({ hp: this, amount: amount });
    }
    /** A shorthand for `this.setMax(this.max + amount)`. */
    changeMax(amount) { this.setMax(this.max + amount); }
}
