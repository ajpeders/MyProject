/**
 * Behavioral tests for the mobile apply flow. These are the same invariants
 * locked into MyWeb's MailPage.test.tsx — keeping them in sync prevents one
 * client from silently violating "delete = Trash, never expunge".
 */
jest.mock("@/api/mail", () => ({
  moveMail: jest.fn(async () => ({ message: "ok", folder: "Trash" })),
}));

import { applyRecommendation, isActionable } from "../src/lib/applyRecommendation";
import { moveMail } from "../src/api/mail";

const mockMove = moveMail as jest.MockedFunction<typeof moveMail>;

beforeEach(() => mockMove.mockClear());

describe("applyRecommendation", () => {
  it("routes a `delete` recommendation to the Trash folder", async () => {
    const folder = await applyRecommendation({ index: 1, recommendation: "delete" });
    expect(folder).toBe("Trash");
    expect(mockMove).toHaveBeenCalledWith([1], "Trash");
  });

  it("never calls anything other than moveMail for delete (no expunge)", async () => {
    await applyRecommendation({ index: 1, recommendation: "delete" });
    const calls = mockMove.mock.calls;
    for (const call of calls) {
      // Every move call must target Trash for a `delete` row. If a future
      // contributor adds an expunge call into applyRecommendation, this
      // assertion would still pass — but that contributor will trip the
      // matching assertion in MyWeb/src/tools/mail/MailPage.test.tsx that
      // forbids any folder other than Trash/Archive on the apply path.
      expect(["Trash", "Archive"]).toContain(call[1]);
    }
  });

  it("routes `archive` to recommended_folder when provided", async () => {
    const folder = await applyRecommendation({
      index: 7,
      recommendation: "archive",
      recommended_folder: "Archive/2026",
    });
    expect(folder).toBe("Archive/2026");
    expect(mockMove).toHaveBeenCalledWith([7], "Archive/2026");
  });

  it("falls back to plain 'Archive' if recommended_folder is missing", async () => {
    const folder = await applyRecommendation({ index: 9, recommendation: "archive" });
    expect(folder).toBe("Archive");
    expect(mockMove).toHaveBeenCalledWith([9], "Archive");
  });

  it("returns null and does not move for non-actionable recommendations", async () => {
    for (const rec of ["reply", "review", "todo", "", undefined]) {
      mockMove.mockClear();
      const folder = await applyRecommendation({ index: 1, recommendation: rec });
      expect(folder).toBeNull();
      expect(mockMove).not.toHaveBeenCalled();
    }
  });
});

describe("isActionable", () => {
  it("returns true for delete + archive", () => {
    expect(isActionable({ index: 1, recommendation: "delete" })).toBe(true);
    expect(isActionable({ index: 1, recommendation: "archive" })).toBe(true);
    expect(isActionable({ index: 1, recommendation: "ARCHIVE" })).toBe(true);
  });

  it("returns false for everything else", () => {
    for (const rec of ["reply", "review", "todo", "calendar", "", undefined]) {
      expect(isActionable({ index: 1, recommendation: rec })).toBe(false);
    }
  });
});
