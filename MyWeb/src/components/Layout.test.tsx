import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";

vi.mock("../api/auth", () => ({
  isAdmin: vi.fn(() => false),
  logout: vi.fn(),
}));

function TestLayout() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<div>Home Content</div>} />
      </Route>
    </Routes>
  );
}

describe("Layout", () => {
  it("renders sidebar with Home, Mail, Budget, and Settings links", () => {
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mail" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Budget" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("does not render removed tool links", () => {
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: "Chat" })).toBeNull();
    expect(screen.queryByRole("link", { name: "DevTeam" })).toBeNull();
    expect(screen.queryByRole("link", { name: "News" })).toBeNull();
  });

  it("renders MyAgent heading", () => {
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "MyAgent" })).toBeInTheDocument();
  });

  it("renders logout and collapse buttons", () => {
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    const buttons = screen.getAllByRole("button");
    expect(buttons.some(b => b.textContent?.includes("Logout"))).toBe(true);
    expect(buttons.some(b => b.textContent?.includes("collapse"))).toBe(true);
  });

  it("renders outlet content", () => {
    render(<MemoryRouter><TestLayout /></MemoryRouter>);
    expect(screen.getByText("Home Content")).toBeInTheDocument();
  });
});
