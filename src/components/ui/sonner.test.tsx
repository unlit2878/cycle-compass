import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "./sonner";

const mock = vi.hoisted(() => ({
  props: [] as Array<Record<string, unknown>>,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("sonner", () => ({
  Toaster: (props: Record<string, unknown>) => {
    mock.props.push(props);
    return null;
  },
  toast: {},
}));

describe("Toaster motion defaults", () => {
  beforeEach(() => {
    mock.props.length = 0;
  });

  it("enables horizontal dismissal and expanded list layout", () => {
    renderToStaticMarkup(<Toaster />);

    const props = mock.props.at(-1);
    expect(props).toMatchObject({
      position: "bottom-center",
      expand: true,
      gap: 8,
      visibleToasts: 4,
      swipeDirections: ["left", "right"],
      pauseWhenPageIsHidden: true,
    });
    expect(props?.closeButton).toBeUndefined();
  });

  it("keeps motion styling when callers override toast options", () => {
    renderToStaticMarkup(
      <Toaster
        className="custom-toaster"
        expand={false}
        toastOptions={{ classNames: { toast: "custom-toast" } }}
      />,
    );

    const props = mock.props.at(-1);
    const toastOptions = props?.toastOptions as {
      classNames?: Record<string, string>;
    };

    expect(props?.expand).toBe(false);
    expect(props?.className).toContain("app-toaster");
    expect(props?.className).toContain("custom-toaster");
    expect(toastOptions.classNames?.toast).toContain("app-toast");
    expect(toastOptions.classNames?.toast).toContain("custom-toast");
    expect(toastOptions.classNames?.icon).toContain("app-toast-icon");
  });
});
