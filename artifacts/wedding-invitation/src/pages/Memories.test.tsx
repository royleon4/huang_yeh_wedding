import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import Memories from "./Memories";

describe("/Memories", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ photos: ["first.jpg", "second.jpg"] }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("renders at /Memories when opened or refreshed directly", async () => {
    window.history.replaceState({}, "", "/Memories");
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Memories" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "回到婚禮首頁" }).getAttribute("href"),
    ).toBe("/");
  });

  it("shows the public photos in a read-only gallery", async () => {
    render(<Memories />);

    expect(
      await screen.findByRole("heading", { name: "Memories" }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "開啟照片 1" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "開啟照片 2" })).toBeTruthy();
    expect(screen.queryByText("上傳照片")).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/photos");
  });

  it("supports next, previous, and close controls in the lightbox", async () => {
    const user = userEvent.setup();
    render(<Memories />);

    const firstPhoto = await screen.findByRole("button", {
      name: "開啟照片 1",
    });
    await user.click(firstPhoto);

    expect(screen.getByRole("dialog", { name: "婚禮照片 1" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "上一張" }).hasAttribute("disabled"),
    ).toBe(true);

    await user.click(screen.getByRole("button", { name: "下一張" }));
    expect(screen.getByRole("dialog", { name: "婚禮照片 2" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "上一張" }));
    expect(screen.getByRole("dialog", { name: "婚禮照片 1" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "關閉" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(firstPhoto);
  });

  it("uses and updates the same saved language preference as the invitation", async () => {
    localStorage.setItem("weddingLang", "en");
    const user = userEvent.setup();
    render(<Memories />);

    expect(await screen.findByText("Back to the wedding")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "切換語言 / Toggle language" }),
    );

    expect(await screen.findByText("回到婚禮首頁")).toBeTruthy();
    expect(localStorage.getItem("weddingLang")).toBe("zh");
  });
});
