const UNIT_MAP: Record<string, string> = {
  gram: "g",
  grams: "g",
  g: "g",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  ml: "ml",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  l: "l",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  pound: "lb",
  pounds: "lb",
  lb: "lb",
  lbs: "lb",
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  can: "can",
  cans: "can",
  piece: "pc",
  pieces: "pc",
  pc: "pc",
  pcs: "pc"
};

const TOKEN_SPLIT = /\s+/;

function singularizeToken(token: string): string {
  if (token.length <= 3) {
    return token;
  }
  if (token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("ses")) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

export function normalizeName(name: string): string {
  const compact = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ");

  return compact
    .split(TOKEN_SPLIT)
    .map((token) => singularizeToken(token))
    .join(" ")
    .trim();
}

export function normalizeUnit(unit?: string | null): string | null {
  if (!unit) {
    return null;
  }

  const compact = unit.toLowerCase().trim().replace(/[^a-z]/g, "");
  if (!compact) {
    return null;
  }

  return UNIT_MAP[compact] ?? compact;
}

export function areUnitsCompatible(a?: string | null, b?: string | null): boolean {
  const unitA = normalizeUnit(a);
  const unitB = normalizeUnit(b);

  if (!unitA && !unitB) {
    return true;
  }

  return unitA === unitB;
}
