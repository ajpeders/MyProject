import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CarsPage from "./CarsPage";
import * as carsApi from "../../api/cars";

vi.mock("../../api/cars", () => ({
  searchCars: vi.fn(),
}));

const mockResponse: carsApi.CarSearchResponse = {
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
      url: "https://autotrader.com/listing/1",
      image_url: null,
      dealer: "Bay Auto",
    },
  ],
  sites: [
    { site: "autotrader", label: "AutoTrader", count: 1 },
    { site: "cars_com", label: "Cars.com", count: 0, error: "timeout" },
  ],
};

describe("CarsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(carsApi, "searchCars").mockResolvedValue(mockResponse);
  });

  it("renders the search form", () => {
    render(<CarsPage />);
    expect(screen.getByRole("heading", { name: "Car Search" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Toyota")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Search cars/ })).toBeInTheDocument();
  });

  it("searches and renders aggregated listings with price and source", async () => {
    render(<CarsPage />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Toyota"), { target: { value: "Toyota" } });
    fireEvent.click(screen.getByRole("button", { name: /Search cars/ }));

    expect(await screen.findByRole("link", { name: "2018 Toyota Camry SE" })).toHaveAttribute(
      "href",
      "https://autotrader.com/listing/1",
    );
    expect(screen.getByText("$18,995")).toBeInTheDocument();
    expect(screen.getByText("42,000 mi")).toBeInTheDocument();
    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
  });

  it("passes filters and selected default sites to the API", async () => {
    render(<CarsPage />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Toyota"), { target: { value: "Toyota" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Camry"), { target: { value: "Camry" } });
    fireEvent.click(screen.getByRole("button", { name: /Search cars/ }));

    await waitFor(() => expect(carsApi.searchCars).toHaveBeenCalled());
    const [filters, sites] = vi.mocked(carsApi.searchCars).mock.calls[0];
    expect(filters.make).toBe("Toyota");
    expect(filters.model).toBe("Camry");
    expect(Array.isArray(sites)).toBe(true);
    expect(sites).toContain("autotrader");
  });

  it("warns about sites that could not be reached", async () => {
    render(<CarsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Search cars/ }));

    expect(await screen.findByText(/Couldn't reach: Cars\.com/)).toBeInTheDocument();
  });

  it("shows an empty state when no listings are returned", async () => {
    vi.spyOn(carsApi, "searchCars").mockResolvedValue({ listings: [], sites: [] });
    render(<CarsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Search cars/ }));

    expect(await screen.findByText(/No listings matched your search/)).toBeInTheDocument();
  });

  it("shows an error when the search fails", async () => {
    vi.spyOn(carsApi, "searchCars").mockRejectedValue(new Error("Backend unavailable"));
    render(<CarsPage />);
    fireEvent.click(screen.getByRole("button", { name: /Search cars/ }));

    expect(await screen.findByText("Backend unavailable")).toBeInTheDocument();
  });

  it("requires at least one site to be selected", async () => {
    render(<CarsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Choose sites/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    fireEvent.click(screen.getByRole("button", { name: /Search cars/ }));

    expect(await screen.findByText("Select at least one site to search.")).toBeInTheDocument();
    expect(carsApi.searchCars).not.toHaveBeenCalled();
  });

  it("lets the user reveal and toggle sites, persisting the selection", async () => {
    render(<CarsPage />);

    fireEvent.click(screen.getByRole("button", { name: /Choose sites/ }));
    const bringATrailer = screen.getByRole("checkbox", { name: "Bring a Trailer" });
    expect(bringATrailer).not.toBeChecked();

    fireEvent.click(bringATrailer);
    expect(bringATrailer).toBeChecked();

    // Persisted to localStorage so the next mount keeps the choice.
    const stored = JSON.parse(localStorage.getItem("myagent.cars.enabled_sites") || "[]");
    expect(stored).toContain("bringatrailer");
  });
});
