import test from "node:test";
import assert from "node:assert/strict";
import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { BetToggleGroup } from "../components/BetToggleGroup";
import { setupDom } from "./test-utils";

test("bet options visibility follows selection", async t => {
  const cleanup = setupDom();
  t.after(cleanup);

  const container = document.createElement("div");
  document.body.appendChild(container);

  function Harness() {
    const [selected, setSelected] = useState<0 | 1 | null>(null);
    return (
      <StrictMode>
        <div>
          <BetToggleGroup
            selected={selected}
            onChange={setSelected}
            options={[
              { value: 0, label: "Yes", accent: "yes" },
              { value: 1, label: "No", accent: "no" },
            ]}
          />
          {selected !== null && (
            <div data-testid="bet-options">Bet options visible</div>
          )}
        </div>
      </StrictMode>
    );
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(<Harness />);
  });

  const [yesButton, noButton] = Array.from(container.querySelectorAll("button"));
  assert.ok(yesButton, "Yes button renders");
  assert.equal(container.querySelector('[data-testid="bet-options"]'), null, "bet options hidden by default");

  await act(async () => {
    yesButton.click();
  });
  assert.ok(container.querySelector('[data-testid="bet-options"]'), "bet options appear after selecting a side");

  await act(async () => {
    noButton.click();
  });
  assert.equal(yesButton.getAttribute("data-selected"), "false");
  assert.equal(noButton.getAttribute("data-selected"), "true");
  assert.ok(container.querySelector('[data-testid="bet-options"]'), "bet options remain visible when switching sides");

  await act(async () => {
    noButton.click();
  });
  assert.equal(noButton.getAttribute("data-selected"), "false");
  assert.equal(container.querySelector('[data-testid="bet-options"]'), null, "bet options hide when deselecting");
});
