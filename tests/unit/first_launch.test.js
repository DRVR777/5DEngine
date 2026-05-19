import { it, expect, vi, afterEach } from "vitest";
import { mountFirstLaunch } from "../../src/systems/first_launch.js";

afterEach(() => vi.useRealTimers());

const APPS = { gamemodes: { title: "GAME MODES", body: () => "<p>pick mode</p>" } };

function makeEls() {
  const homeEl  = { style: { display: "block" } };
  const titleEl = { textContent: "" };
  const bodyEl  = { innerHTML: "" };
  const classList = [];
  const winEl   = { classList: { add: (c) => classList.push(c) } };
  const getEl   = (id) => ({ appHome: homeEl, appTitle: titleEl, appBody: bodyEl, appWindow: winEl }[id] || null);
  return { homeEl, titleEl, bodyEl, classList, winEl, getEl };
}

it("calls finishComputerEntry and navigates to gamemodes when first launch", () => {
  vi.useFakeTimers();
  const { homeEl, titleEl, bodyEl, classList, getEl } = makeEls();
  let entered = false;
  mountFirstLaunch({
    getFirstLaunch:      () => true,
    finishComputerEntry: () => { entered = true; },
    getApps:             () => APPS,
    getEl,
  });
  vi.runAllTimers();
  expect(entered).toBe(true);
  expect(homeEl.style.display).toBe("none");
  expect(titleEl.textContent).toBe("GAME MODES");
  expect(bodyEl.innerHTML).toBe("<p>pick mode</p>");
  expect(classList).toContain("open");
});

it("skips entirely when getFirstLaunch returns false", () => {
  vi.useFakeTimers();
  let entered = false;
  const { getEl } = makeEls();
  mountFirstLaunch({ getFirstLaunch: () => false, finishComputerEntry: () => { entered = true; }, getApps: () => APPS, getEl });
  vi.runAllTimers();
  expect(entered).toBe(false);
});

it("mountFirstLaunch is a function that does not throw on call", () => {
  vi.useFakeTimers();
  const { getEl } = makeEls();
  expect(() => mountFirstLaunch({
    getFirstLaunch:      () => false,
    finishComputerEntry: () => {},
    getApps:             () => APPS,
    getEl,
  })).not.toThrow();
  vi.runAllTimers();
});
