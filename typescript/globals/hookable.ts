/** A function that takes one parameter. */
export type OneFunction<ParameterPack, ReturnType> = (pack?: ParameterPack) => ReturnType;
/** A function that takes no parameters. */
export type EmptyFunction<ReturnType> = () => ReturnType;
/** A function that can take zero or one parameters. */
export type SimpleFunction<ParameterPack, ReturnType> = OneFunction<ParameterPack, ReturnType> | EmptyFunction<ReturnType>;

export type OneHookFunction<ParameterPack, ReturnType> = (orig: OneFunction<ParameterPack, ReturnType>) => OneFunction<ParameterPack, ReturnType>;
export type EmptyHookFunction<ReturnType> = (orig: EmptyFunction<ReturnType>) => EmptyFunction<ReturnType>;
/** Mutates a function, returning a new one that takes the same arguments. */
export type HookFunction<ParameterPack, ReturnType> = OneHookFunction<ParameterPack, ReturnType> | EmptyFunction<ReturnType>;

export interface Hook<ParameterPack, ReturnType> {
  hook: HookFunction<ParameterPack, ReturnType>;
  /** For identification purposes. Should be unique and in the format `author.mod.hook`. */
  id: string;
}
export interface OneHook<ParameterPack, ReturnType> extends Hook<ParameterPack, ReturnType> {
  hook: OneHookFunction<ParameterPack, ReturnType>;
}
export interface EmptyHook<ReturnType> extends Hook<undefined, ReturnType> {
  hook: EmptyHookFunction<ReturnType>;
}

/** A function that can be mutated by a mod or other effect. */
export abstract class Hookable<ParameterPack, ReturnType> {
  static all: Hookable<any, any>[] = [];
  abstract orig: SimpleFunction<ParameterPack, ReturnType>;
  hooks: Hook<ParameterPack, ReturnType>[] = [];
  constructor() {
    Hookable.all.push(this);
  }
}
export let hookById = (id: string) => Hookable.all.map(x => x.hooks).flat().find(x => x.id == id);

export class OneHookable<ParameterPack, ReturnType> extends Hookable<ParameterPack, ReturnType> {
  orig: OneFunction<ParameterPack, ReturnType>;
  hooks: OneHook<ParameterPack, ReturnType>[] = [];
  constructor(orig: SimpleFunction<ParameterPack, ReturnType>) {
    super();
    this.orig = orig;
  }
  call(pack: ParameterPack) {
    try {
      let func = this.hooks.reduce((f, hook) => hook.hook(f), this.orig);
      return func(pack);
    } catch(e) {
      alert("ERROR::ONEHOOK::'" + e + "'");
    }
  }
}

export class EmptyHookable<ReturnType> extends Hookable<undefined, ReturnType> {
  orig: EmptyFunction<ReturnType>;
  hooks: EmptyHook<ReturnType>[] = [];
  constructor(orig: EmptyFunction<ReturnType>) {
    super();
    this.orig = orig;
  }
  call() {
    try {
      let func = this.hooks.reduce((f, hook) => hook.hook(f), this.orig);
      return func();
    } catch(e) {
      alert("ERROR::EMPTYHOOK::'" + e + "'");
    }
  }
}