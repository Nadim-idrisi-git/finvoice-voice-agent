import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";
vi.mock("./services/api", () => ({
  api: { dashboard: vi.fn().mockResolvedValue(null), actions: vi.fn().mockResolvedValue([]) },
  money: (n) => `\u20B9${n}`,
}));
describe("application shell", () => {
  it("renders the workspace navigation and text fallback", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".brand")?.textContent).toContain("finvoice");
    expect(screen.getByRole("textbox", { name: "Ask about your finances" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start voice session" })).toBeInTheDocument();
  });
});
