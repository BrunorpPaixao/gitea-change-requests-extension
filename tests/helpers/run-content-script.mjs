import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const CONTENT_CORE_PATH = new URL("../../content.js", import.meta.url);
const CONTENT_ROUTER_PATH = new URL("../../content-router.js", import.meta.url);
const CONTENT_CORE_TEXT = readFileSync(CONTENT_CORE_PATH, "utf8");
const CONTENT_ROUTER_TEXT = readFileSync(CONTENT_ROUTER_PATH, "utf8");

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

  dom.window.eval(CONTENT_CORE_TEXT);
  dom.window.eval(CONTENT_ROUTER_TEXT);

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
