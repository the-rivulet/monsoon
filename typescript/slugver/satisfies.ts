import type { SlugverRange } from "./range.js";

export let satisfies = (version: string, range: SlugverRange) => {
  if(!range) return false;
  return range.test(version);
}