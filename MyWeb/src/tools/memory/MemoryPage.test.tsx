import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MemoryPage from "./MemoryPage";
import * as memory from "../../api/memory";

vi.mock("../../api/memory", () => ({
  listMemories: vi.fn(),
  addMemory: vi.fn(),
  deleteMemory: vi.fn(),
}));

describe("MemoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(memory, "listMemories").mockResolvedValue([
      {
        memory_id: "mem-1",
        content: "Prefers DuckDuckGo for search.",
        created_at: 1_776_672_000,
      },
    ]);
    vi.spyOn(memory, "addMemory").mockResolvedValue({
      memory_id: "mem-2",
      content: "Uses Ollama locally.",
      created_at: 1_776_672_100,
    });
    vi.spyOn(memory, "deleteMemory").mockResolvedValue({});
  });

  it("loads and displays memories", async () => {
    render(<MemoryPage />);

    expect(await screen.findByRole("heading", { name: "Memory" })).toBeInTheDocument();
    expect(await screen.findByText("Prefers DuckDuckGo for search.")).toBeInTheDocument();
    expect(memory.listMemories).toHaveBeenCalledWith("");
  });

  it("searches memories semantically", async () => {
    vi.spyOn(memory, "listMemories")
      .mockResolvedValueOnce([
        { memory_id: "mem-1", content: "Prefers DuckDuckGo for search." },
      ])
      .mockResolvedValueOnce([
        { memory_id: "mem-3", content: "Searches with DuckDuckGo and summarizes with Ollama.", score: 0.984 },
      ]);

    render(<MemoryPage />);
    await screen.findByText("Prefers DuckDuckGo for search.");

    fireEvent.change(screen.getByLabelText("Search Memories"), { target: { value: "duckduckgo ollama" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(memory.listMemories).toHaveBeenLastCalledWith("duckduckgo ollama");
    });
    expect(await screen.findByText(/Showing matches for "duckduckgo ollama"\./)).toBeInTheDocument();
    expect(screen.getByText(/score 0.984/)).toBeInTheDocument();
  });

  it("adds a memory and reloads the list", async () => {
    render(<MemoryPage />);
    await screen.findByText("Prefers DuckDuckGo for search.");

    fireEvent.change(screen.getByLabelText("Add Memory"), { target: { value: "Uses Ollama locally." } });
    fireEvent.click(screen.getByRole("button", { name: "Save Memory" }));

    await waitFor(() => {
      expect(memory.addMemory).toHaveBeenCalledWith("Uses Ollama locally.");
    });
    expect(await screen.findByText("Memory saved.")).toBeInTheDocument();
    expect(memory.listMemories).toHaveBeenLastCalledWith("");
  });

  it("deletes a memory and reloads the list", async () => {
    render(<MemoryPage />);
    await screen.findByText("Prefers DuckDuckGo for search.");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(memory.deleteMemory).toHaveBeenCalledWith("mem-1");
    });
    expect(await screen.findByText("Memory deleted.")).toBeInTheDocument();
  });
});
