export type CarRegion =
  | "US"
  | "Canada"
  | "UK"
  | "Europe"
  | "Australia"
  | "Auctions";

export const CAR_REGIONS: CarRegion[] = [
  "US",
  "Canada",
  "UK",
  "Europe",
  "Australia",
  "Auctions",
];

export interface CarSource {
  /** Stable identifier sent to the backend aggregator. */
  id: string;
  /** Human-friendly name shown in the UI. */
  label: string;
  region: CarRegion;
  /** Landing page, used for attribution and as a fallback link. */
  homepage: string;
  /** Whether the site is included in a default search. */
  enabledByDefault: boolean;
}

/**
 * Catalog of car-listing marketplaces the aggregator can query. The backend
 * (`POST /api/cars/search`) decides which of these it can actually reach; the
 * frontend just advertises the full menu and forwards the user's selection.
 */
export const CAR_SOURCES: CarSource[] = [
  // United States — mainstream marketplaces
  { id: "autotrader", label: "AutoTrader", region: "US", homepage: "https://www.autotrader.com", enabledByDefault: true },
  { id: "cars_com", label: "Cars.com", region: "US", homepage: "https://www.cars.com", enabledByDefault: true },
  { id: "cargurus", label: "CarGurus", region: "US", homepage: "https://www.cargurus.com", enabledByDefault: true },
  { id: "truecar", label: "TrueCar", region: "US", homepage: "https://www.truecar.com", enabledByDefault: true },
  { id: "edmunds", label: "Edmunds", region: "US", homepage: "https://www.edmunds.com", enabledByDefault: true },
  { id: "kbb", label: "Kelley Blue Book", region: "US", homepage: "https://www.kbb.com", enabledByDefault: true },
  { id: "carvana", label: "Carvana", region: "US", homepage: "https://www.carvana.com", enabledByDefault: true },
  { id: "carmax", label: "CarMax", region: "US", homepage: "https://www.carmax.com", enabledByDefault: true },
  { id: "autolist", label: "Autolist", region: "US", homepage: "https://www.autolist.com", enabledByDefault: true },
  { id: "autotempest", label: "AutoTempest", region: "US", homepage: "https://www.autotempest.com", enabledByDefault: true },
  { id: "carsdirect", label: "CarsDirect", region: "US", homepage: "https://www.carsdirect.com", enabledByDefault: false },
  { id: "carfax", label: "Carfax Used Cars", region: "US", homepage: "https://www.carfax.com", enabledByDefault: false },
  { id: "iseecars", label: "iSeeCars", region: "US", homepage: "https://www.iseecars.com", enabledByDefault: false },
  { id: "autonation", label: "AutoNation", region: "US", homepage: "https://www.autonation.com", enabledByDefault: false },
  { id: "enterprise", label: "Enterprise Car Sales", region: "US", homepage: "https://www.enterprisecarsales.com", enabledByDefault: false },

  // United States — peer-to-peer / classifieds
  { id: "craigslist", label: "Craigslist", region: "US", homepage: "https://www.craigslist.org", enabledByDefault: true },
  { id: "facebook", label: "Facebook Marketplace", region: "US", homepage: "https://www.facebook.com/marketplace", enabledByDefault: true },
  { id: "ebay_motors", label: "eBay Motors", region: "US", homepage: "https://www.ebay.com/motors", enabledByDefault: true },
  { id: "offerup", label: "OfferUp", region: "US", homepage: "https://offerup.com", enabledByDefault: false },
  { id: "hemmings", label: "Hemmings (classics)", region: "US", homepage: "https://www.hemmings.com", enabledByDefault: false },

  // Canada
  { id: "autotrader_ca", label: "AutoTrader.ca", region: "Canada", homepage: "https://www.autotrader.ca", enabledByDefault: false },
  { id: "kijiji_autos", label: "Kijiji Autos", region: "Canada", homepage: "https://www.kijijiautos.ca", enabledByDefault: false },
  { id: "clutch_ca", label: "Clutch", region: "Canada", homepage: "https://www.clutch.ca", enabledByDefault: false },

  // United Kingdom
  { id: "autotrader_uk", label: "Auto Trader UK", region: "UK", homepage: "https://www.autotrader.co.uk", enabledByDefault: false },
  { id: "pistonheads", label: "PistonHeads", region: "UK", homepage: "https://www.pistonheads.com", enabledByDefault: false },
  { id: "motors_uk", label: "Motors.co.uk", region: "UK", homepage: "https://www.motors.co.uk", enabledByDefault: false },
  { id: "gumtree", label: "Gumtree", region: "UK", homepage: "https://www.gumtree.com", enabledByDefault: false },

  // Continental Europe
  { id: "mobile_de", label: "Mobile.de", region: "Europe", homepage: "https://www.mobile.de", enabledByDefault: false },
  { id: "autoscout24", label: "AutoScout24", region: "Europe", homepage: "https://www.autoscout24.com", enabledByDefault: false },
  { id: "leboncoin", label: "leboncoin", region: "Europe", homepage: "https://www.leboncoin.fr", enabledByDefault: false },

  // Australia
  { id: "carsales", label: "Carsales", region: "Australia", homepage: "https://www.carsales.com.au", enabledByDefault: false },
  { id: "carsguide", label: "CarsGuide", region: "Australia", homepage: "https://www.carsguide.com.au", enabledByDefault: false },

  // Auction / salvage
  { id: "bringatrailer", label: "Bring a Trailer", region: "Auctions", homepage: "https://bringatrailer.com", enabledByDefault: false },
  { id: "cars_and_bids", label: "Cars & Bids", region: "Auctions", homepage: "https://carsandbids.com", enabledByDefault: false },
  { id: "copart", label: "Copart (salvage)", region: "Auctions", homepage: "https://www.copart.com", enabledByDefault: false },
  { id: "iaai", label: "IAAI (salvage)", region: "Auctions", homepage: "https://www.iaai.com", enabledByDefault: false },
];

const ENABLED_SITES_STORAGE_KEY = "myagent.cars.enabled_sites";

const VALID_SITE_IDS = new Set(CAR_SOURCES.map((source) => source.id));

export function defaultEnabledSiteIds(): string[] {
  return CAR_SOURCES.filter((source) => source.enabledByDefault).map((source) => source.id);
}

/**
 * Load the user's saved site selection, falling back to the default set. Unknown
 * ids (e.g. a source removed from the catalog) are dropped.
 */
export function loadEnabledSiteIds(): string[] {
  const raw = localStorage.getItem(ENABLED_SITES_STORAGE_KEY);
  if (!raw) return defaultEnabledSiteIds();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultEnabledSiteIds();

    const valid = parsed.filter(
      (id): id is string => typeof id === "string" && VALID_SITE_IDS.has(id),
    );
    // An empty (but valid) selection is a legitimate user choice; only fall back
    // to defaults when nothing usable was stored.
    return valid.length > 0 || parsed.length === 0 ? valid : defaultEnabledSiteIds();
  } catch {
    return defaultEnabledSiteIds();
  }
}

export function saveEnabledSiteIds(ids: string[]): void {
  const valid = ids.filter((id) => VALID_SITE_IDS.has(id));
  localStorage.setItem(ENABLED_SITES_STORAGE_KEY, JSON.stringify(valid));
}
