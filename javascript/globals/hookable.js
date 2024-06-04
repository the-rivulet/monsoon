/** A function that can be mutated by a mod or other effect. */
export class Hookable {
    static all = [];
    hooks = [];
    constructor() {
        Hookable.all.push(this);
    }
}
export let hookById = (id) => Hookable.all.map(x => x.hooks).flat().find(x => x.id == id);
export class OneHookable extends Hookable {
    orig;
    hooks = [];
    constructor(orig) {
        super();
        this.orig = orig;
    }
    call(pack) {
        try {
            let func = this.hooks.reduce((f, hook) => hook.hook(f), this.orig);
            return func(pack);
        }
        catch (e) {
            alert("ERROR::ONEHOOK::'" + e + "'");
        }
    }
}
export class EmptyHookable extends Hookable {
    orig;
    hooks = [];
    constructor(orig) {
        super();
        this.orig = orig;
    }
    call() {
        try {
            let func = this.hooks.reduce((f, hook) => hook.hook(f), this.orig);
            return func();
        }
        catch (e) {
            alert("ERROR::EMPTYHOOK::'" + e + "'");
        }
    }
}
