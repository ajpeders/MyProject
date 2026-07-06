import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchCars } from "./cars";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(status === 204 ? "" : JSON.stringify(data)),
  } as Response);
}

describe("cars API", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("posts filters and selected sites to /api/cars/search", async () => {
    mockFetch.mockResolvedValue(mockResponse({ listings: [], sites: [] }));

    await searchCars(
      { make: "Toyota", model: "Camry", max_price: 20000, sort: "price_asc" },
      ["autotrader", "cars_com"],
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/cars/search"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          make: "Toyota",
          model: "Camry",
          max_price: 20000,
          sort: "price_asc",
          sites: ["autotrader", "cars_com"],
        }),
      }),
    );
  });

  it("returns aggregated listings and per-site results", async () => {
    const data = {
      listings: [
        {
          id: "1",
          site: "autotrader",
          site_label: "AutoTrader",
          title: "2018 Toyota Camry SE",
          price: 18995,
          year: 2018,
          make: "Toyota",
          model: "Camry",
          mileage: 42000,
          location: "San Francisco, CA",
          url: "https://autotrader.com/1",
          image_url: null,
          dealer: "Bay Auto",
        },
      ],
      sites: [
        { site: "autotrader", label: "AutoTrader", count: 1 },
        { site: "cars_com", label: "Cars.com", count: 0, error: "timeout" },
      ],
    };
    mockFetch.mockResolvedValue(mockResponse(data));

    const result = await searchCars({ make: "Toyota" }, ["autotrader", "cars_com"]);

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].title).toBe("2018 Toyota Camry SE");
    expect(result.sites[1].error).toBe("timeout");
  });
});
