// in its own file to avoid local bindings
export async function evaluate(script: string) {
  await eval(script);
}