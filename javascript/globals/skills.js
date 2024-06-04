import { log } from "./core.js";
import { OneHookable } from "./hookable.js";
export var CheckResult;
(function (CheckResult) {
    CheckResult[CheckResult["success"] = 0] = "success";
    CheckResult[CheckResult["partial"] = 1] = "partial";
    CheckResult[CheckResult["failure"] = 2] = "failure";
})(CheckResult || (CheckResult = {}));
export var Skill;
(function (Skill) {
    Skill[Skill["agility"] = 0] = "agility";
    Skill[Skill["comprehension"] = 1] = "comprehension";
    Skill[Skill["endurance"] = 2] = "endurance";
    Skill[Skill["finesse"] = 3] = "finesse";
    Skill[Skill["influence"] = 4] = "influence";
    Skill[Skill["perception"] = 5] = "perception";
    Skill[Skill["power"] = 6] = "power";
    Skill[Skill["stealth"] = 7] = "stealth";
    Skill[Skill["will"] = 8] = "will";
})(Skill || (Skill = {}));
export let getSkillHook = new OneHookable((pack) => {
    return pack.owner.skills.score(pack.skill);
});
export class Skillset {
    static empty = new Skillset(0, 0, 0, 0, 0, 0, 0, 0, 0);
    static roll(skill) {
        let successes = 0;
        for (let i = 0; i < 2 + skill; i++)
            if (Math.random() < 0.5)
                successes++;
        log((2 + skill) + "d6>4 = " + successes);
        return successes;
    }
    static goal(skill, target) {
        let roll = this.roll(skill);
        return roll >= target ? CheckResult.success : roll + 1 >= target ? CheckResult.partial : CheckResult.failure;
    }
    static contest(skill1, skill2) {
        return this.roll(skill1) >= this.roll(skill2);
    }
    agility = 0;
    comprehension = 0;
    endurance = 0;
    finesse = 0;
    influence = 0;
    perception = 0;
    power = 0;
    stealth = 0;
    will = 0;
    constructor(agi, com, end, fin, inf, per, pow, ste, wil) {
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
    score(skill) {
        if (skill == Skill.agility)
            return this.agility;
        if (skill == Skill.comprehension)
            return this.comprehension;
        if (skill == Skill.endurance)
            return this.endurance;
        if (skill == Skill.finesse)
            return this.finesse;
        if (skill == Skill.influence)
            return this.influence;
        if (skill == Skill.perception)
            return this.perception;
        if (skill == Skill.power)
            return this.power;
        if (skill == Skill.stealth)
            return this.stealth;
        return this.will;
    }
    roll(skill) {
        log("Making a " + Skill[skill] + " check...");
        return Skillset.roll(this.score(skill));
    }
    check(skill, target) {
        log("Making a " + Skill[skill] + " check against DC " + target + "...");
        return Skillset.goal(this.score(skill), target);
    }
    contest(skill, other, skill2) {
        skill2 ??= skill;
        log("Making a " + Skill[skill] + " vs. " + Skill[skill2] + " contest...");
        return Skillset.contest(this.score(skill), other.skills.score(skill2));
    }
}
