import { CORE, Result, log } from "./globals/core.js";
export class Action {
    static undoTop() {
        if (actionStack.length)
            actionStack.pop().undo();
    }
    /**
     * Performs the action and adds it to the stack.
     * @returns The result of the action. If success, the action was added to the stack.
     */
    activate() {
        let result = this.do();
        if (result != Result.ok) {
            log("error: " + Result[result]);
            return result;
        }
        actionStack.push(this);
        return Result.ok;
    }
}
export let actionStack = [];
export class StepAction extends Action {
    id = `${CORE}.step`;
    target;
    stepX;
    stepY;
    constructor(target, stepX, stepY) {
        super();
        this.target = target;
        this.stepX = stepX;
        this.stepY = stepY;
    }
    do() { return this.target.step(this.target.pos.x + this.stepX, this.target.pos.y + this.stepY); }
    undo() { this.target.step(this.target.pos.x - this.stepX, this.target.pos.y - this.stepY); }
}
export class FallAction extends Action {
    id = `${CORE}.step`;
    target;
    stepX;
    stepY;
    constructor(target, stepX, stepY) {
        super();
        this.target = target;
        this.stepX = stepX;
        this.stepY = stepY;
    }
    do() {
        return this.target.step(this.target.pos.x + this.stepX, this.target.pos.y + this.stepY);
    }
    undo() {
        this.target.step(this.target.pos.x - this.stepX, this.target.pos.y - this.stepY);
    }
}
