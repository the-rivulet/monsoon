import { CORE, ctx, getId, nextUUID, JumpStage, Result, roll } from "./globals/core.js";
import { HitPoints, Living } from "./hitpoints.js";
import { OneHookable } from "./globals/hookable.js";
import { Skill, Skillset, SkillsetOwner } from "./globals/skills.js";
import { HandSlot, Item, InventoryOwner, Slot } from "./item.js";
import { loopStart, tick } from "./loop.js";
import { Position, Region, Renderable, Solidity, walkable, world } from "./map.js";

/** An activated ability that a creature can have. They often have a cost in actions, blessings, or food. */
abstract class Ability {
  owner: Creature;
  constructor(owner: Creature) {
    this.owner = owner;
  }
  /**
   * Decide whether a given position is valid for this ability.
   * @param targetPos The position to try to execute it on.
   */
  abstract tryActivate(targetPos: Position): Result;
  /**
   * Execute the ability. Assume all preconditions are met.
   * @param targetPos The position to execute the ability on.
   */
  abstract onSuccess(targetPos: Position): void;
  activate(targetPos: Position) {
    let result = this.tryActivate(targetPos);
    if(result == Result.ok) this.onSuccess(targetPos);
    return result;
  }
}

class UnarmedAttackAbility extends Ability {
  m: number;
  n: number;
  addPower: boolean;
  constructor(owner: Creature, m: number, n: number, addPower = true) {
    super(owner);
    this.m = m;
    this.n = n;
    this.addPower = this.addPower;
  }
  tryActivate(targetPos: Position) {
    if(!this.owner.actionsLeft) return Result.err_tired;
    if(!this.owner.pos.near(targetPos)) return Result.err_too_far;
    if(!this.owner.pos.region.creatureAt(targetPos.x, targetPos.y)) return Result.err_invalid;
    return Result.ok;
  }
  onSuccess(targetPos: Position) {
    this.owner.actionsLeft--;
    this.owner.pos.region.creatureAt(targetPos.x, targetPos.y).hp.hurt(roll(this.m, this.n) + (this.addPower ? this.owner.skills.power : 0), this.owner);
  }
}

export class Team {
  static teamList: Team[] = [];
  static next() {
    let c = this.teamList.indexOf(this.teamList.find(x => x.active));
    let next = (c + 1 == this.teamList.length ? 0 : c + 1);
    this.teamList[next].activate();
  }
  /** Should be unique to this team and in the format `author.mod.team`. */
  id: string;
  name: string;
  active: boolean;
  teammates: Creature[];
  activate() {
    for(let i of Team.teamList) {
      i.active = false;
      for(let j of i.teammates) {
        // it is not your turn anymore ahaha
        j.actionsLeft = 0;
        j.speedLeft = 0;
        j.jumpLeft = 0;
        j.fall();
      }
    }
    this.active = true;
    for(let j of this.teammates) {
      j.refresh();
      if(j instanceof AICreature) {
        j.takeTurn();
      }
    }
  }
  constructor(name: string, id: string, active = false) {
    this.name = name;
    this.id = id;
    this.active = active;
    Team.teamList.push(this);
  }
  end() {
    if(this.active) Team.next();
  }
}

export let enemyTeam = new Team("Enemy", `${CORE}.enemy`);
export let playerTeam = new Team("Player", `${CORE}.player`, true);

/** Something that can be named, tamed, hurt, and killed. */
export abstract class Creature implements SkillsetOwner, Living, Renderable, InventoryOwner {
  /** Should be unique to this creature and in the format `author.mod.creature`. */
  abstract id: string;
  uuid: number;
  /** This creature's hit point status. */
  hp: HitPoints;
  /** The base amount of max HP this creature has. */
  abstract baseHp: number;
  /** The species this creature belongs to, such as "Green Lizard". */
  abstract species: string;
  /** This creature's name if it is named, such as "Nova". */
  nickname?: string;
  /** Returns this creature's name if it is named, otherwise returns its species. */
  get name() {
    return this.nickname || this.species;
  }
  /** A short description of this creature. They are italicized in the Monsoon rulebook. */
  abstract description: string;
  /** This creature's skills, used for making checks. */
  abstract skills: Skillset;
  /** This creature's position in the world. */
  pos: Position;
  /** The amount of movement this creature can take in a turn. */
  getSpeed() { return 0; }
  /** The amount of movement this creature has remaining in the current turn. */
  speedLeft: number;
  /** The number of actions this creature can take in a turn. Usually 2. */
  getActions() { return 2; }
  /** The number of actions this creature has left. */
  actionsLeft: number;
  /** Determines how high and far this creature can jump. */
  getJump() { return 1; }
  /** The stage of jump this creature is in. */
  jumpStage = JumpStage.ascent;
  /** How much movement the creature has left in the current jump stage. */
  jumpLeft: number;
  /** Whether this creature is capable of flight. */
  flying = true;
  /** This creature's inventory slots. */
  inventory: Slot[] = [];
  /** This creature's abilities. These are a bit complicated. */
  abstract abilities: Ability[];
  /** Which team this creature is on. */
  team: Team;
  constructor(x: number, y: number, r: Region, name?: string, team = enemyTeam) {
    this.pos = new Position(x, y, r);
    if(name) this.nickname = name;
    this.team = team;
    team.teammates.push(this);
    this.uuid = nextUUID();
  }
  /** Get rid of this. */
  destroy() {
    this.pos.region.creatures.splice(this.pos.region.creatures.indexOf(this), 1);
    this.team.teammates.splice(this.team.teammates.indexOf(this), 1);
    for(let i of this.inventory.filter(x => x.item)) i.item.unequip(this.pos);
  }
  /** Place the creature in the world, and do other setup tasks. */
  realize() {
    if(!this.pos.region.creatures.includes(this)) this.pos.region.creatures.push(this);
    this.speedLeft = this.getSpeed();
    this.jumpLeft = this.getJump();
    this.actionsLeft = this.getActions();
    this.hp = new HitPoints(this);
  }
  /** Returns whether this creature is in combat. */
  get inCombat() {
    return this.pos.region.creatures.some(x => this.pos.canSee(x.pos));
  }
  abstract render(x: number, y: number, tileSize: number): void;
  /**
   * Render the creature's region from its current position, and return the mouse position found,
   * if it is hovering anything. Useful for player characters. */
  renderHere() { this.pos.region.render(this.pos.x, this.pos.y); }
  /**
   * Test whether a single step is possible.
   * @param x The X position to try to move to.
   * @param y The Y position to try to move to.
   * @returns Whether it is possible to move there.
   */
  tryStep(x: number, y: number) {
    if(!this.pos.region.tileAt(x, y)) return Result.err_invalid;
    let p = new Position(x, y, this.pos.region);
    if(this.pos.is(p)) return Result.ok;
    let d = this.pos.dist(p) - (y > this.pos.y ? 1 : 0);
    if(d > this.speedLeft) return Result.err_tired;
    if(!this.pos.near(p)) return Result.err_too_far;
    if(!walkable(p)) return Result.err_invalid;
    if(this.flying) return Result.ok;
    let w1 = walkable(this.pos.plus(0, 1));
    let w2 = walkable(p.plus(0, 1));
    if(this.pos.y == y) return ((!w1 && !w2) || (w2 && this.jumpLeft) || (!w2 && this.jumpStage != JumpStage.descent && this.jumpLeft)) ? Result.ok : Result.err_tired;
    else if(this.pos.y - 1 == y) return this.jumpStage == JumpStage.ascent ? Result.ok : Result.err_tired;
    else return Result.ok;
  }
  /**
   * Forcefully try to move this creature to the target position.
   * @param x The X position to move to.
   * @param y The Y position to move to.
   * @returns Whether the movement was successful.
   */
  private singleMove(x: number, y: number) {
    let attempt = this.tryStep(x, y);
    if(attempt != Result.ok) return attempt;
    let p = new Position(x, y, this.pos.region);
    let w1 = walkable(this.pos.plus(0, 1));
    let w2 = walkable(p.plus(0, 1));
    if(this.pos.y == y) {
      if(!w1 && !w2) {
        this.pos = p;
      } else if(w2 && this.jumpLeft) {
        if(this.jumpStage == JumpStage.ascent) {
          this.jumpStage = JumpStage.peak;
          this.jumpLeft = this.getJump();
        }
        this.jumpLeft--;
        if(!this.jumpLeft) this.jumpStage = JumpStage.descent;
        this.pos = p;
      } else if(!w2 && this.jumpStage != JumpStage.descent && this.jumpLeft) {
        this.pos = p;
      }
    } else if(this.pos.y - 1 == y) {
      if(this.jumpStage == JumpStage.ascent) {
        this.jumpLeft--;
        if(!this.jumpLeft) {this.jumpStage = JumpStage.peak; this.jumpLeft = this.getJump(); }
        this.pos = p;
      }
    } else if(this.pos.y + 1 == y) {
      if(w2) {
        this.jumpStage = JumpStage.descent;
        this.jumpLeft = 0;
      }
      this.pos = p;
    }
    return Result.ok;
  }
  /** Refresh jump, speed, and actions, if needed. */
  refresh(force = true) {
    let w1 = walkable(this.pos.plus(0, 1));
    if(!w1 || this.flying) {
      this.jumpStage = JumpStage.ascent;
      this.jumpLeft = this.getJump();
      if(!this.inCombat || force) {
        this.speedLeft = this.getSpeed();
        this.actionsLeft = this.getActions();
      }
    }
  }
  /**
   * Take a single step.
   * @param x The new X position to move to.
   * @param y The new Y position to move to.
   * @param run Whether to actually do the movement.
   * @returns Whether the movement was successful.
   */
  step(x: number, y: number) {
    let d = (y < this.pos.y ? 1 : 0) + Math.abs(this.pos.x - x);
    this.refresh(false);
    let s = this.singleMove(x, y);
    if(s == Result.ok) {
      this.speedLeft -= d;
      this.refresh(false);
      for(let i of this.pos.region.items) i.fall();
    }
    return s;
  }
  /** Drop down, potentially taking fall damage. */
  fall() {
    let fallen = 0;
    while(this.step(this.pos.x, this.pos.y + 1) == Result.ok) fallen++;
    // TODO: possible agility check to reduce damage
    if(fallen > 10 && !this.flying) this.hp.hurt(fallen - 10);
  }
  /**
   * Pick up an item.
   * @param item The item to pick up.
   * @param handSlot Try to pick up the item in a specific slot.
   * @returns Whether the item was picked up successfully.
   */
  pickup(item: Item, handSlot?: HandSlot) {
    if(!this.pos.is(item.pos)) return Result.err_too_far;
    if(handSlot && handSlot.owner != this) return Result.err_invalid;
    if(!this.actionsLeft) return Result.err_tired;
    // if a hand wasn't specified, then look for one
    handSlot ??= this.inventory.find(x => x instanceof HandSlot && !x.item);
    if(!handSlot) return Result.err_empty; // if we still didn't find one, then we failed
    let result = handSlot.store(item);
    if(result == Result.ok) this.actionsLeft--;
    return result;
  }
  /**
   * Throw an item.
   * @param slot The slot to throw from.
   * @param target The position to throw to. If there is a creature there, the creature will be targeted.
   * @returns Whether the throw was successful.
   */
  throw(slot: Slot, target: Position) {
    if(!this.pos.canSee(target)) return Result.err_needs_sight;
    if(slot.owner != this) return Result.err_invalid;
    if(!slot.item) return Result.err_empty;
    let i = slot.item;
    if(!this.actionsLeft) return Result.err_tired;
    this.actionsLeft--;
    let p = this.pos.center;
    let x = p.x, y = p.y, dx = target.center.x - p.x, dy = target.center.y - p.y;
    dx /= 100; dy /= 100;
    // the item will continue traveling until hitting something...
    let pos = new Position(x, y, this.pos.region);
    let toIgnore: Creature[] = [this];
    for(let iter = 0; iter < 1000; iter++) { // ... for an (almost) arbitrary length of time
      x += dx; y += dy;
      let c = pos.region.creatureAt(x, y);
      if(c && !toIgnore.includes(c)) {
        if(this.skills.contest(Skill.finesse, c, Skill.agility)) {
          // HIT!
          i.impactCreature(this, c);
          break;
        } else {
          toIgnore.push(c);
        }
      } else if(!pos.region.tileAt(x, y) || pos.region.tileAt(x, y).solidity == Solidity.solid) {
        i.impactSurface(this, new Position(x, y, pos.region).fix);
        break;
      }
      pos = new Position(x, y, this.pos.region);
      //alert("moved to " + pos + " (change: " + dx + ", " + dy + ")");
    }
    if(i.volatile) i.destroy();
    else {
      i.unequip(pos.fix);
      i.fall();
    }
    return Result.ok;
  }
}

abstract class AICreature extends Creature {
  abstract takeTurn(): void;
}

export class Dropwig extends AICreature {
  id = `${CORE}.dropwig`;
  baseHp = 10;
  species = "Dropwig";
  description = `Ambush predators that leave desirable items to catch the attention of prey,
  latching onto the ceiling above for a surprise attack.`;
  skills = new Skillset(2, 0, 0, 3, 0, 2, 1, 0, 0);
  getSpeed = () => 10;
  abilities = [new UnarmedAttackAbility(this, 2, 4, false)];
  render(x: number, y: number, tileSize: number) {
    ctx.drawImage(getId<HTMLImageElement>(this.id), x, y, tileSize, tileSize);
  }
  takeTurn() {
    let target = this.pos.region.creatures.find(x => x.team != this.team && this.pos.near(x.pos));
  }
}

/** A character-like creature with adaptations, rites, etc. */
export abstract class SapientCreature extends Creature {
  /** Sapient creatures have a base jump height of 4. */
  getJump = () => 4;
  adaptations: Ability[] = [];
  constructor(x: number, y: number, r: Region, name?: string, team = playerTeam) {
    super(x, y, r, name, team);
  }
}

/** The active character. */
export let player: SapientCreature;
/** Starts a new run with the selected character. */
export let startRunHook = new OneHookable((char: SapientCreature) => {
  if(tick > 0) return;
  getId("game").style.display = "block";
  player = char;
  player.realize();
  // render the player repeatedly
  loopStart(player);
});

/**
 * Registers a character, making it selectable in the new run screen.
 * @param char The character to be registered.
 */
export function registerCharacter(char: SapientCreature) {
  //alert("NOTE::'registering character';'" + char.id + "'");
  let element = document.createElement("button");
  element.classList.add("char");
  element.textContent = char.name;
  element.onclick = function() {
    getId("chardetails").innerHTML = "";
    // show the info
    let header = document.createElement("h2");
    header.textContent = char.name;
    getId("chardetails").appendChild(header);
    let description = document.createElement("p");
    description.innerHTML = char.description + "<br/><br/>Base HP: " + char.baseHp;
    getId("chardetails").appendChild(description);
    let startRun = document.createElement("button");
    startRun.textContent = "Start Run";
    startRun.onclick = () => startRunHook.call(char);
    getId("chardetails").appendChild(startRun);
  };
  getId("charselector").appendChild(element);
}

/** A basic character, for testing purposes. */
export class Slugcat extends SapientCreature {
  id = `${CORE}.slugcat`;
  species = "Slugcat";
  baseHp = 10;
  description = `Slugcats are nomadic creatures who travel with their families.
  Many yearn for a simple, peaceful life in the trees, but being near the bottom of the food chain
  tends to disrupt that dream. Iterators are also fond of slugcats,
  modifying them and sending them out to complete tasks.`;
  skills = new Skillset(1, 1, 1, 1, 1, 1, 1, 1, 1);
  getSpeed = () => 12; // modified for testing purposes
  inventory = [new HandSlot(this)];
  abilities = [new UnarmedAttackAbility(this, 1, 1)];
  render(x: number, y: number, tileSize: number) {
    ctx.drawImage(getId<HTMLImageElement>(this.id), x, y, tileSize, tileSize);
  }
}

// Spawn creatures in the world.
new Dropwig(-5, 0, world.outskirts, "Jeremy").realize();