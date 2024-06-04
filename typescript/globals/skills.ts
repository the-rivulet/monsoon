import { log } from "./core.js";
import { OneHookable } from "./hookable.js";

export enum CheckResult {success, partial, failure }
export enum Skill { agility, comprehension, endurance, finesse, influence, perception, power, stealth, will }
export interface SkillsetOwner { skills: Skillset; }
type GetSkillPack = {owner: SkillsetOwner, skill: Skill};
export let getSkillHook = new OneHookable((pack: GetSkillPack) => {
  return pack.owner.skills.score(pack.skill);
});

export class Skillset {
  static empty = new Skillset(0, 0, 0, 0, 0, 0, 0, 0, 0);
  static roll(skill: number) {
    let successes = 0;
    for(let i = 0; i < 2 + skill; i++) if(Math.random() < 0.5) successes++;
    log((2 + skill) + "d6>4 = " + successes);
    return successes;
  }
  static goal(skill: number, target: number) {
    let roll = this.roll(skill);
    return roll >= target ? CheckResult.success : roll + 1 >= target ? CheckResult.partial : CheckResult.failure;
  }
  static contest(skill1: number, skill2: number) {
    return this.roll(skill1) >= this.roll(skill2);
  }
  agility = 0;
  comprehension = 0
  endurance = 0;
  finesse = 0;
  influence = 0;
  perception = 0;
  power = 0;
  stealth = 0;
  will = 0;
  constructor(agi: number, com: number, end: number, fin: number, inf: number, per: number, pow: number, ste: number, wil: number) {
    this.agility = agi;
    this.comprehension = com;
    this.endurance = end;
    this.finesse = fin;
    this.influence = inf;
    this.perception = per;
    this.power = pow;
    this.stealth = ste;
    this.will = wil;
  }
  score(skill: Skill): number {
    if(skill == Skill.agility) return this.agility;
    if(skill == Skill.comprehension) return this.comprehension;
    if(skill == Skill.endurance) return this.endurance;
    if(skill == Skill.finesse) return this.finesse;
    if(skill == Skill.influence) return this.influence;
    if(skill == Skill.perception) return this.perception;
    if(skill == Skill.power) return this.power;
    if(skill == Skill.stealth) return this.stealth;
    return this.will;
  }
  roll(skill: Skill) {
    log("Making a " + Skill[skill] + " check...");
    return Skillset.roll(this.score(skill));
  }
  check(skill: Skill, target: number) {
    log("Making a " + Skill[skill] + " check against DC " + target + "...");
    return Skillset.goal(this.score(skill), target);
  }
  contest(skill: Skill, other: SkillsetOwner, skill2?: Skill) {
    skill2 ??= skill;
    log("Making a " + Skill[skill] + " vs. " + Skill[skill2] + " contest...");
    return Skillset.contest(this.score(skill), other.skills.score(skill2));
  }
}