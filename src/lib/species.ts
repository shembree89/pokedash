export function speciesKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function sameSpecies(a: string, b: string): boolean {
  return speciesKey(a) === speciesKey(b);
}
