import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChatPage from "./ChatPage";
import * as search from "../../api/search";

vi.mock("../../api/search", () => ({
  searchWeb: vi.fn(),
}));

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(search, "searchWeb").mockResolvedValue({
      answer: "DuckDuckGo results summarized by Ollama.",
      results: [],
    });
  });

  it("shows an inline search answer", async () => {
    render(<ChatPage />);

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "latest search design" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(search.searchWeb).toHaveBeenCalledWith("latest search design");
    });
    expect(await screen.findByText("DuckDuckGo results summarized by Ollama.")).toBeInTheDocument();
  });
});
