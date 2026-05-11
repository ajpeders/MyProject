import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import WhisperPage from "./WhisperPage";
import * as whisperApi from "../../api/whisper";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../../api/whisper", () => ({
  transcribe: vi.fn(),
  voiceAgent: vi.fn(),
  listTranscripts: vi.fn(),
  deleteTranscript: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <WhisperPage />
    </MemoryRouter>,
  );
}

async function captureBlob(mode?: "agent" | "transcribe") {
  let stopHandler: (() => void) | null = null;
  const recorder: Partial<MediaRecorder> & { state: string; mimeType: string } = {
    state: "inactive",
    mimeType: "audio/webm",
    start() {
      recorder.state = "recording";
    },
    stop() {
      recorder.state = "inactive";
      // simulate dataavailable then onstop
      // @ts-expect-error mock
      recorder.ondataavailable?.({ data: new Blob(["x"], { type: "audio/webm" }) });
      stopHandler?.();
    },
  };
  Object.defineProperty(recorder, "onstop", {
    set(handler) { stopHandler = handler; },
  });
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = function (this: unknown) {
    return recorder;
  } as unknown;
  (globalThis as unknown as { MediaRecorder: { isTypeSupported: (t: string) => boolean } }).MediaRecorder.isTypeSupported = () => true;
  // @ts-expect-error mock
  global.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
  };
  if (mode === "transcribe") fireEvent.click(screen.getByRole("tab", { name: "Transcribe" }));
  fireEvent.click(screen.getByRole("button", { name: /start recording/i }));
  await waitFor(() => expect(recorder.state).toBe("recording"));
  fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));
}

describe("WhisperPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    vi.spyOn(whisperApi, "listTranscripts").mockResolvedValue([
      {
        transcript_id: "t1",
        source: "web",
        text: "previous recording",
        language: "en",
        duration_seconds: 1.2,
        segments: [],
        model: "base",
        captured_at: 1_776_672_000,
      },
    ]);
    vi.spyOn(whisperApi, "deleteTranscript").mockResolvedValue(undefined);
  });

  it("loads history on mount", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Whisper" })).toBeInTheDocument();
    expect(await screen.findByText(/previous recording/)).toBeInTheDocument();
    expect(whisperApi.listTranscripts).toHaveBeenCalledWith(50);
  });

  it("shows empty state when no transcripts", async () => {
    vi.spyOn(whisperApi, "listTranscripts").mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/No transcripts yet/)).toBeInTheDocument();
  });

  it("shows source badge for each entry", async () => {
    vi.spyOn(whisperApi, "listTranscripts").mockResolvedValue([
      {
        transcript_id: "t1",
        source: "web",
        text: "from browser",
        language: null,
        duration_seconds: 1.0,
        segments: [],
        model: "base",
        captured_at: 1_776_672_000,
      },
      {
        transcript_id: "t2",
        source: "shortcut",
        text: "from phone",
        language: null,
        duration_seconds: 2.0,
        segments: [],
        model: "base",
        captured_at: 1_776_672_100,
      },
    ]);
    renderPage();
    await screen.findByText("from browser");
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("shortcut")).toBeInTheDocument();
  });

  it("populates latest pre-block when a history row is clicked", async () => {
    renderPage();
    const row = await screen.findByText(/previous recording/);
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByText(/"transcript_id": "t1"/)).toBeInTheDocument();
    });
  });

  it("deletes a transcript optimistically", async () => {
    renderPage();
    await screen.findByText(/previous recording/);
    fireEvent.click(screen.getByRole("button", { name: /delete transcript/i }));
    await waitFor(() => {
      expect(whisperApi.deleteTranscript).toHaveBeenCalledWith("t1");
    });
    await waitFor(() => {
      expect(screen.queryByText(/previous recording/)).not.toBeInTheDocument();
    });
  });

  it("restores entry when delete fails", async () => {
    vi.spyOn(whisperApi, "deleteTranscript").mockRejectedValue(new Error("nope"));
    renderPage();
    await screen.findByText(/previous recording/);
    fireEvent.click(screen.getByRole("button", { name: /delete transcript/i }));
    await waitFor(() => {
      expect(screen.getByText("nope")).toBeInTheDocument();
    });
    expect(screen.getByText(/previous recording/)).toBeInTheDocument();
  });

  it("shows mic permission error when getUserMedia rejects", async () => {
    // @ts-expect-error mock
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
    };
    renderPage();
    await screen.findByText(/previous recording/);
    fireEvent.click(screen.getByRole("button", { name: /start recording/i }));
    expect(await screen.findByText("Permission denied")).toBeInTheDocument();
  });

  it("runs voice agent and displays the reply + tool chip on default Agent mode", async () => {
    vi.spyOn(whisperApi, "voiceAgent").mockResolvedValue({
      transcript_id: "agent-1",
      transcript: "remind me to buy milk",
      tool: "save_note",
      args: { text: "buy milk" },
      result: { memory_id: "m-1" },
      reply: "Saved.",
      error: null,
      captured_at: 1_776_672_500,
    });
    renderPage();
    await screen.findByText(/previous recording/);
    await captureBlob();
    await waitFor(() => expect(whisperApi.voiceAgent).toHaveBeenCalled());
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(screen.getByText("Saved a note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open \/memory/i })).toBeInTheDocument();
    expect(whisperApi.transcribe).not.toHaveBeenCalled();
  });

  it("deep-links to the tool page when the chip's button is clicked", async () => {
    vi.spyOn(whisperApi, "voiceAgent").mockResolvedValue({
      transcript_id: "agent-2",
      transcript: "what's on my calendar tomorrow",
      tool: "list_events",
      args: { start: "2026-05-12", end: "2026-05-12" },
      result: [],
      reply: "Nothing scheduled.",
      error: null,
      captured_at: 1_776_672_600,
    });
    renderPage();
    await screen.findByText(/previous recording/);
    await captureBlob();
    const openBtn = await screen.findByRole("button", { name: /open \/calendar/i });
    fireEvent.click(openBtn);
    expect(navigateMock).toHaveBeenCalledWith("/calendar");
  });

  it("surfaces a visible error banner when the agent call fails", async () => {
    vi.spyOn(whisperApi, "voiceAgent").mockRejectedValue(new Error("LLM timed out"));
    renderPage();
    await screen.findByText(/previous recording/);
    await captureBlob();
    expect(await screen.findByText("LLM timed out")).toBeInTheDocument();
    expect(screen.queryByTestId("agent-reply-card")).not.toBeInTheDocument();
  });
});
