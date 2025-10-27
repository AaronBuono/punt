import test from "node:test";
import assert from "node:assert/strict";
import React, { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { BetToggleGroup } from "../components/BetToggleGroup";
import { setupDom } from "./test-utils";

test("toggle group selects and deselects via mouse", async t => {
  const cleanup = setupDom();
  t.after(cleanup);

  const container = document.createElement("div");
  document.body.appendChild(container);

  function Harness() {
    const [selected, setSelected] = useState<0 | 1 | null>(null);
    return (
      <StrictMode>
        <BetToggleGroup
          selected={selected}
          onChange={setSelected}
          options={[
            { value: 0, label: "Yes", accent: "yes" },
            { value: 1, label: "No", accent: "no" },
          ]}
        />
      </StrictMode>
    );
  }

  const root = createRoot(container);

  await act(async () => {
    root.render(<Harness />);
  });

  const buttons = Array.from(container.querySelectorAll("button"));
  assert.equal(buttons.length, 2, "expects two option buttons");
  assert.equal(buttons[0].getAttribute("data-selected"), "false");
  assert.equal(buttons[1].getAttribute("data-selected"), "false");

  await act(async () => {
    buttons[0].click();
  });
  assert.equal(buttons[0].getAttribute("data-selected"), "true");
  assert.equal(buttons[1].getAttribute("data-selected"), "false");

  await act(async () => {
    buttons[0].click();
  });
  assert.equal(buttons[0].getAttribute("data-selected"), "false");
});

test("toggle group responds to keyboard", async t => {
  const cleanup = setupDom();
  t.after(cleanup);

  const container = document.createElement("div");
  document.body.appendChild(container);

  function Harness() {
    const [selected, setSelected] = useState<0 | 1 | null>(null);
    return (
      <StrictMode>
        <BetToggleGroup
          selected={selected}
          onChange={setSelected}
          options={[
            { value: 0, label: "Yes", accent: "yes" },
            { value: 1, label: "No", accent: "no" },
          ]}
        />
      </StrictMode>
    );
  }

  const root = createRoot(container);

  await act(async () => {
    root.render(<Harness />);
  });

  const [yesButton, noButton] = Array.from(container.querySelectorAll("button"));

  await act(async () => {
    yesButton.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
  });
  assert.equal(yesButton.getAttribute("data-selected"), "true");

  await act(async () => {
    yesButton.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  assert.equal(yesButton.getAttribute("data-selected"), "false");

  await act(async () => {
    noButton.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  assert.equal(noButton.getAttribute("data-selected"), "true");
});
