const WECHAT_USER_AGENT = /MicroMessenger/i;

export function isWeChatBrowser(windowRef = globalThis.window) {
  return WECHAT_USER_AGENT.test(String(windowRef?.navigator?.userAgent ?? ""));
}

export function visualViewportBottomInset(windowRef = globalThis.window) {
  const viewport = windowRef?.visualViewport;
  const layoutHeight = Number(windowRef?.innerHeight);
  const visualHeight = Number(viewport?.height);
  const visualOffsetTop = Number(viewport?.offsetTop);

  if (
    !Number.isFinite(layoutHeight) ||
    !Number.isFinite(visualHeight) ||
    !Number.isFinite(visualOffsetTop)
  ) {
    return 0;
  }

  return Math.max(0, layoutHeight - visualHeight - visualOffsetTop);
}

export function bindWeChatVisualViewportBottom(
  element,
  windowRef = globalThis.window,
) {
  if (!element || !isWeChatBrowser(windowRef)) return () => {};

  const viewport = windowRef?.visualViewport;
  if (!viewport?.addEventListener) return () => {};

  const previousBottom = element.style.getPropertyValue("bottom");
  const previousPriority = element.style.getPropertyPriority("bottom");

  const update = () => {
    const position = windowRef.getComputedStyle?.(element)?.position;
    if (position !== "fixed") {
      element.style.removeProperty("bottom");
      return;
    }
    element.style.setProperty(
      "bottom",
      `${visualViewportBottomInset(windowRef)}px`,
    );
  };

  update();
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  windowRef.addEventListener?.("resize", update);

  return () => {
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
    windowRef.removeEventListener?.("resize", update);
    if (previousBottom) {
      element.style.setProperty("bottom", previousBottom, previousPriority);
    } else {
      element.style.removeProperty("bottom");
    }
  };
}
