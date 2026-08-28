import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";

vi.mock("../api/auth", () => ({
  isAuthenticated: vi.fn(() => false),
  loginAccount: vi.fn(),
  registerAccount: vi.fn(),
  storeAuthResponse: vi.fn(),
}));

describe("LoginPage", () => {
  it("renders email and password fields", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
  });

  it("renders login and register tabs", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register" })).toBeInTheDocument();
  });

  it("shows Sign In button by default", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("switches to register mode", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
  });

  it("shows confirm password field in register mode", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByLabelText(/confirm/i)).toBeInTheDocument();
  });
});
