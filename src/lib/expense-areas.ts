/** Canonical expense areas for spend analysis. */

export const EXPENSE_AREAS = [
  {
    name: "Online Food",
    icon: "🍔",
    classification: "WANT" as const,
    aliases: ["swiggy", "zomato", "online food", "food delivery", "food"],
  },
  {
    name: "Hotel Food",
    icon: "🏨",
    classification: "LUXURY" as const,
    aliases: ["hotel food", "hotel", "expensive restaurant", "restaurant", "dining"],
  },
  {
    name: "Online Grocery",
    icon: "🛒",
    classification: "NEED" as const,
    aliases: ["zepto", "blinkit", "bigbasket", "big basket", "instamart", "online grocery"],
  },
  {
    name: "Local Grocery",
    icon: "🏪",
    classification: "NEED" as const,
    aliases: ["dmart", "d-mart", "reliance", "grocery", "groceries", "local grocery", "supermarket"],
  },
  {
    name: "Vegetable",
    icon: "🥦",
    classification: "NEED" as const,
    aliases: ["vegetable", "vegetables", "veg", "sabzi"],
  },
  {
    name: "Fruits",
    icon: "🍎",
    classification: "NEED" as const,
    aliases: ["fruit", "fruits"],
  },
  {
    name: "Uber",
    icon: "🚗",
    classification: "WANT" as const,
    aliases: ["uber", "ola", "rapido", "auto", "cab", "taxi"],
  },
  {
    name: "Travel",
    icon: "🧳",
    classification: "WANT" as const,
    aliases: ["travel", "metro", "bus", "train", "flight", "parking", "toll"],
  },
  {
    name: "Snacks",
    icon: "🍪",
    classification: "WANT" as const,
    aliases: ["snacks", "snack", "tea", "coffee", "tea/coffee", "chai", "bakery"],
  },
  {
    name: "Pharmacy",
    icon: "💊",
    classification: "NEED" as const,
    aliases: ["pharmacy", "medical store", "medplus", "apollo pharmacy"],
  },
  {
    name: "Medical",
    icon: "🩺",
    classification: "NEED" as const,
    aliases: ["medical", "doctor", "hospital", "clinic", "lab", "health"],
  },
  {
    name: "Fuel",
    icon: "⛽",
    classification: "NEED" as const,
    aliases: ["fuel", "petrol", "diesel", "cng", "ev charge"],
  },
  {
    name: "Rentals",
    icon: "🏠",
    classification: "NEED" as const,
    aliases: ["rent", "rental", "rentals", "house rent", "home rent"],
  },
  {
    name: "Online Shopping",
    icon: "📦",
    classification: "WANT" as const,
    aliases: [
      "amazon",
      "flipkart",
      "myntra",
      "meesho",
      "ajio",
      "shopping",
      "online shopping",
      "gadgets",
    ],
  },
  {
    name: "Others",
    icon: "📋",
    classification: "WANT" as const,
    aliases: ["others", "other", "misc", "miscellaneous", "recharge", "electricity", "maid", "subscriptions", "gym", "movies"],
  },
] as const;

export type ExpenseAreaName = (typeof EXPENSE_AREAS)[number]["name"];

export const EXPENSE_AREA_NAMES: ExpenseAreaName[] = EXPENSE_AREAS.map((a) => a.name);

const CANONICAL = new Set(EXPENSE_AREA_NAMES.map((n) => n.toLowerCase()));

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve a free-text merchant / note / category to a canonical expense area. */
export function resolveExpenseArea(
  merchant?: string | null,
  notes?: string | null,
  categoryName?: string | null
): ExpenseAreaName {
  const merchantNorm = merchant ? normalize(merchant) : "";
  if (merchantNorm && CANONICAL.has(merchantNorm)) {
    return EXPENSE_AREAS.find((a) => normalize(a.name) === merchantNorm)!.name;
  }

  const haystacks = [merchant, notes, categoryName]
    .filter(Boolean)
    .map((v) => normalize(String(v)));

  for (const area of EXPENSE_AREAS) {
    if (area.name === "Others") continue;
    for (const alias of area.aliases) {
      const a = normalize(alias);
      for (const h of haystacks) {
        if (h === a || h.includes(a) || a.includes(h)) {
          return area.name;
        }
      }
    }
  }

  return "Others";
}

export function getExpenseAreaMeta(name: string) {
  return (
    EXPENSE_AREAS.find((a) => normalize(a.name) === normalize(name)) ||
    EXPENSE_AREAS.find((a) => a.name === "Others")!
  );
}

/** List shown in Quick Add / filters (canonical areas). */
export const EXPENSE_MERCHANTS = EXPENSE_AREA_NAMES;

export type ExpenseMerchant = ExpenseAreaName;
