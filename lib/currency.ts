export type CurrencyCode =
  | "COP"
  | "MXN"
  | "USD"
  | "EUR"
  | "PEN"
  | "ARS"
  | "CLP"
  | "DOP"
  | "CRC"
  | "GTQ"
  | "BOB"
  | "PYG"
  | "UYU";

export interface CurrencyDefaults {
  pricePerMeter: number;
  directFabricCost: number;
  threadCost: number;
  zipperCost: number;
  interfacingCost: number;
  hourlyRate: number;
  orderTotal: number;
  orderDeposit: number;
}

export interface CurrencyConfig {
  code: CurrencyCode;
  name: string;
  country: string;
  symbol: string;
  shortLabel: string;
  suffixCode: boolean;
  locale: string;
  decimals: 0 | 2;
  step: number;
  defaults: CurrencyDefaults;
}

export const CURRENCIES: CurrencyConfig[] = [
  {
    code: "COP",
    name: "Peso colombiano",
    country: "Colombia",
    symbol: "$",
    shortLabel: "COP ($)",
    suffixCode: true,
    locale: "es-CO",
    decimals: 0,
    step: 500,
    defaults: {
      pricePerMeter: 28000,
      directFabricCost: 70000,
      threadCost: 4000,
      zipperCost: 6000,
      interfacingCost: 3500,
      hourlyRate: 18000,
      orderTotal: 120000,
      orderDeposit: 60000,
    },
  },
  {
    code: "MXN",
    name: "Peso mexicano",
    country: "México",
    symbol: "$",
    shortLabel: "MXN ($)",
    suffixCode: true,
    locale: "es-MX",
    decimals: 2,
    step: 5,
    defaults: {
      pricePerMeter: 160,
      directFabricCost: 400,
      threadCost: 35,
      zipperCost: 45,
      interfacingCost: 30,
      hourlyRate: 140,
      orderTotal: 950,
      orderDeposit: 475,
    },
  },
  {
    code: "USD",
    name: "Dólar estadounidense",
    country: "EE. UU. / Ecuador / Panamá",
    symbol: "USD $",
    shortLabel: "USD ($)",
    suffixCode: false,
    locale: "en-US",
    decimals: 2,
    step: 0.5,
    defaults: {
      pricePerMeter: 12,
      directFabricCost: 30,
      threadCost: 2.5,
      zipperCost: 3,
      interfacingCost: 2,
      hourlyRate: 15,
      orderTotal: 85,
      orderDeposit: 42.5,
    },
  },
  {
    code: "EUR",
    name: "Euro",
    country: "España / Europa",
    symbol: "€",
    shortLabel: "EUR (€)",
    suffixCode: false,
    locale: "es-ES",
    decimals: 2,
    step: 0.5,
    defaults: {
      pricePerMeter: 12,
      directFabricCost: 30,
      threadCost: 2.5,
      zipperCost: 3,
      interfacingCost: 2,
      hourlyRate: 15,
      orderTotal: 85,
      orderDeposit: 42.5,
    },
  },
  {
    code: "PEN",
    name: "Sol peruano",
    country: "Perú",
    symbol: "S/",
    shortLabel: "PEN (S/)",
    suffixCode: false,
    locale: "es-PE",
    decimals: 2,
    step: 1,
    defaults: {
      pricePerMeter: 28,
      directFabricCost: 70,
      threadCost: 5,
      zipperCost: 6,
      interfacingCost: 4,
      hourlyRate: 18,
      orderTotal: 130,
      orderDeposit: 65,
    },
  },
  {
    code: "ARS",
    name: "Peso argentino",
    country: "Argentina",
    symbol: "$",
    shortLabel: "ARS ($)",
    suffixCode: true,
    locale: "es-AR",
    decimals: 0,
    step: 500,
    defaults: {
      pricePerMeter: 14000,
      directFabricCost: 35000,
      threadCost: 2000,
      zipperCost: 3000,
      interfacingCost: 2000,
      hourlyRate: 9000,
      orderTotal: 65000,
      orderDeposit: 32500,
    },
  },
  {
    code: "CLP",
    name: "Peso chileno",
    country: "Chile",
    symbol: "$",
    shortLabel: "CLP ($)",
    suffixCode: true,
    locale: "es-CL",
    decimals: 0,
    step: 500,
    defaults: {
      pricePerMeter: 7500,
      directFabricCost: 18750,
      threadCost: 1200,
      zipperCost: 1800,
      interfacingCost: 1000,
      hourlyRate: 8000,
      orderTotal: 55000,
      orderDeposit: 27500,
    },
  },
  {
    code: "DOP",
    name: "Peso dominicano",
    country: "Rep. Dominicana",
    symbol: "RD$",
    shortLabel: "DOP (RD$)",
    suffixCode: false,
    locale: "es-DO",
    decimals: 0,
    step: 50,
    defaults: {
      pricePerMeter: 450,
      directFabricCost: 1125,
      threadCost: 90,
      zipperCost: 120,
      interfacingCost: 70,
      hourlyRate: 400,
      orderTotal: 3200,
      orderDeposit: 1600,
    },
  },
  {
    code: "CRC",
    name: "Colón costarricense",
    country: "Costa Rica",
    symbol: "₡",
    shortLabel: "CRC (₡)",
    suffixCode: false,
    locale: "es-CR",
    decimals: 0,
    step: 250,
    defaults: {
      pricePerMeter: 4500,
      directFabricCost: 11250,
      threadCost: 800,
      zipperCost: 1200,
      interfacingCost: 700,
      hourlyRate: 4500,
      orderTotal: 35000,
      orderDeposit: 17500,
    },
  },
  {
    code: "GTQ",
    name: "Quetzal guatemalteco",
    country: "Guatemala",
    symbol: "Q",
    shortLabel: "GTQ (Q)",
    suffixCode: false,
    locale: "es-GT",
    decimals: 2,
    step: 1,
    defaults: {
      pricePerMeter: 65,
      directFabricCost: 162.5,
      threadCost: 12,
      zipperCost: 15,
      interfacingCost: 10,
      hourlyRate: 45,
      orderTotal: 350,
      orderDeposit: 175,
    },
  },
  {
    code: "BOB",
    name: "Boliviano",
    country: "Bolivia",
    symbol: "Bs",
    shortLabel: "BOB (Bs)",
    suffixCode: false,
    locale: "es-BO",
    decimals: 2,
    step: 1,
    defaults: {
      pricePerMeter: 55,
      directFabricCost: 137.5,
      threadCost: 10,
      zipperCost: 14,
      interfacingCost: 8,
      hourlyRate: 40,
      orderTotal: 280,
      orderDeposit: 140,
    },
  },
  {
    code: "PYG",
    name: "Guaraní paraguayo",
    country: "Paraguay",
    symbol: "₲",
    shortLabel: "PYG (₲)",
    suffixCode: false,
    locale: "es-PY",
    decimals: 0,
    step: 1000,
    defaults: {
      pricePerMeter: 55000,
      directFabricCost: 137500,
      threadCost: 8000,
      zipperCost: 12000,
      interfacingCost: 7000,
      hourlyRate: 40000,
      orderTotal: 280000,
      orderDeposit: 140000,
    },
  },
  {
    code: "UYU",
    name: "Peso uruguayo",
    country: "Uruguay",
    symbol: "$U",
    shortLabel: "UYU ($U)",
    suffixCode: false,
    locale: "es-UY",
    decimals: 0,
    step: 25,
    defaults: {
      pricePerMeter: 350,
      directFabricCost: 875,
      threadCost: 65,
      zipperCost: 90,
      interfacingCost: 55,
      hourlyRate: 350,
      orderTotal: 2600,
      orderDeposit: 1300,
    },
  },
];

export const QUICK_CURRENCY_CODES: CurrencyCode[] = [
  "COP",
  "MXN",
  "USD",
  "PEN",
  "EUR",
  "ARS",
  "CLP",
];

export const DEFAULT_CURRENCY: CurrencyCode = "COP";
export const WORKSHOP_CURRENCY_STORAGE_KEY = "moldefacil_moneda_taller";

const CURRENCY_MAP: Record<CurrencyCode, CurrencyConfig> = CURRENCIES.reduce(
  (acc, item) => {
    acc[item.code] = item;
    return acc;
  },
  {} as Record<CurrencyCode, CurrencyConfig>
);

export function isValidCurrencyCode(value: string | null | undefined): value is CurrencyCode {
  return typeof value === "string" && value in CURRENCY_MAP;
}

export function getCurrencyConfig(code?: string | null): CurrencyConfig {
  if (isValidCurrencyCode(code)) {
    return CURRENCY_MAP[code];
  }
  return CURRENCY_MAP[DEFAULT_CURRENCY];
}

/**
 * Formats a numeric value using the selected workshop currency conventions.
 */
export function formatMoney(amount: number, code: CurrencyCode = DEFAULT_CURRENCY): string {
  const cfg = getCurrencyConfig(code);
  const safe = Number.isFinite(amount) ? amount : 0;

  let numText: string;
  if (cfg.decimals === 0) {
    numText = Math.round(safe).toLocaleString(cfg.locale, {
      maximumFractionDigits: 0,
    });
  } else {
    const rounded = Math.round(safe * 100) / 100;
    const hasFraction = Math.abs(rounded - Math.round(rounded)) > 0.001;
    const forceTwoDecimals = cfg.code === "USD" || cfg.code === "EUR";
    numText = rounded.toLocaleString(cfg.locale, {
      minimumFractionDigits: hasFraction || forceTwoDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    });
  }

  return cfg.suffixCode
    ? `${cfg.symbol} ${numText} ${cfg.code}`
    : `${cfg.symbol} ${numText}`;
}

const currencyListeners = new Set<() => void>();

export function subscribeWorkshopCurrency(listener: () => void): () => void {
  currencyListeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    currencyListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

export function getWorkshopCurrencyServerSnapshot(): CurrencyCode {
  return DEFAULT_CURRENCY;
}

export function loadWorkshopCurrency(): CurrencyCode {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return DEFAULT_CURRENCY;
  }
  const stored = window.localStorage.getItem(WORKSHOP_CURRENCY_STORAGE_KEY);
  return isValidCurrencyCode(stored) ? stored : DEFAULT_CURRENCY;
}

export function saveWorkshopCurrency(code: CurrencyCode): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  window.localStorage.setItem(WORKSHOP_CURRENCY_STORAGE_KEY, code);
  currencyListeners.forEach((listener) => listener());
}
