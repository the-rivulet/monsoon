import type { Creature } from "./creature.js";
import { OneHookable } from "./globals/hookable.js";
import { Positioned } from "./map.js";

interface HPOperationPack {
  hp: HitPoints;
  amount: number;
  source?: Creature;
};
export let hurtHook = new OneHookable<HPOperationPack, void>((pack) => {
  pack.hp.cur -= pack.amount;
  // TODO: instead turn this into a corpse...
  if(pack.hp.cur <= 0) pack.hp.owner.destroy();
});
export let healHook = new OneHookable<HPOperationPack, void>((pack) => {
  pack.hp.cur += pack.amount;
});
export let setMaxHook = new OneHookable<HPOperationPack, void>((pack) => {
  pack.hp.max = pack.amount;
});

/** An object that can be damaged, healed, and killed. */
export interface Living extends Positioned {
  /** The base amount of max HP this object has. */
  baseHp: number;
  hp: HitPoints;
}
/** Represents a pool of hit points. */
export class HitPoints {
  /** The `Creature` that owns this pool. */
  owner: Living;
  private _cur: number;
  /** The current HP of this pool. Limited by the max HP. */
  set cur(value: number) {
    this._cur = Math.max(0, value); if(this.max < this.cur) this.cur = this.max;
  }
  get cur() { return this._cur; }
  private _max: number;
  /** The maximum HP of this pool. */
  set max(value: number) {
    this._max = Math.max(0, value); if(this.max < this.cur) this.cur = this.max;
  }
  get max() { return this._max; }
  /**
   * Creates a new `HitPoints` object.
   * @param uuid The UUID of the object that owns this pool.
   * @param max The maximum HP of this pool.
   * @param cur The starting HP of this pool. Defaults to `max`.
   */
  constructor(owner: Living, cur?: number) {
    this.owner = owner;
    let max = owner.baseHp;
    this.cur = (cur ? Math.min(cur, max) : max);
    this.max = max;
  }
  /**
   * Deal damage to this hit point pool.
   * @param amount The amount of damage to be dealt.
   */
  hurt(amount: number, source?: Creature) {
    hurtHook.call({hp: this, amount: amount, source: source});
  }
  /**
   * Heal damage damage this hit point pool.
   * @param amount The amount of damage to be healed.
   */
  heal(amount: number, source?: Creature) {
    healHook.call({hp: this, amount: amount, source: source});
  }
  /**
   * Set the maximum HP of this hit point pool.
   * @param amount The new maximum HP.
   */
  setMax(amount: number) {
    setMaxHook.call({hp: this, amount: amount});
  }
  /** A shorthand for `this.setMax(this.max + amount)`. */
  changeMax(amount: number) { this.setMax(this.max + amount); }
}