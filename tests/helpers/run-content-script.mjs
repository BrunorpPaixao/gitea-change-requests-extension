/**
 * Test harness helper.
 * Boots content scripts in JSDOM and provides a message-based helper for integration-style tests.
 */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const MANIFEST_PATH = new URL("../../manifest.json", import.meta.url);
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const contentScriptFiles = manifest?.content_scripts?.[0]?.js || [];
const contentScriptTexts = contentScriptFiles.map((filePath) => {
  const fileUrl = new URL(`../../${filePath}`, import.meta.url);
  return readFileSync(fileUrl, "utf8");
});

export function createContentHarness({ html, url }) {
  const dom = new JSDOM(html, {
    url,
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });

  const listeners = [];
  dom.window.chrome = {
    runtime: {
      onMessage: {
        addListener(fn) {
          listeners.push(fn);
        },
      },
    },
  };

  for (const scriptText of contentScriptTexts) {
    dom.window.eval(scriptText);
  }

  if (!listeners.length) {
    throw new Error("content script did not register a message listener");
  }

  const listener = listeners[0];

  async function send(message) {
    return await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`timeout waiting response for ${message?.type || "unknown"}`));
        }
      }, 3000);

      const done = (payload) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(payload);
      };

      try {
        const maybeAsync = listener(message, {}, done);
        if (maybeAsync !== true) {
          clearTimeout(timer);
        }
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  return {
    window: dom.window,
    send,
    dispose() {
      dom.window.close();
    },
  };
}
