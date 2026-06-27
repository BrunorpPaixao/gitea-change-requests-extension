/**
 * Shared parser-fixture test data and helpers.
 */
import { readFileSync } from "node:fs";

export const standardHtml = readFileSync(new URL("./fixtures/pr-standard.html", import.meta.url), "utf8");
export const variantHtml = readFileSync(new URL("./fixtures/pr-variant.html", import.meta.url), "utf8");
export const participantsHtml = readFileSync(new URL("./fixtures/pr-participants.html", import.meta.url), "utf8");

export const standaloneCommentHtml = `
<!doctype html>
<html>
  <head><title>#42 - Sample - Git</title></head>
  <body data-signed-user-name="alice">
    <div id="pull-desc-display" class="pull-desc">alice wants to merge feature into main</div>
    <div class="ui segments conversation-holder" id="conv-1">
      <input name="path" value="src/main.js" />
      <input name="line" value="10" />
      <a class="file-comment" href="/acme/sample-repo/pulls/42/files#issuecomment-1001">src/main.js</a>
      <button data-action="Resolve" data-comment-id="1001">Resolve conversation</button>
      <div class="timeline-item comment" id="comment-1001" data-comment-id="1001">
        <a class="author" href="/bob">bob</a>
        <time datetime="2026-01-10T10:00:00.000Z">Jan 10, 2026</time>
        <div class="raw-content">Please rename this variable.</div>
      </div>
    </div>
    <div class="timeline-item comment" id="comment-9001" data-comment-id="9001">
      <div class="content comment-container">
        <a class="author" href="/reviewer">reviewer</a>
        <time datetime="2026-01-11T11:00:00.000Z">Jan 11, 2026</time>
        <div class="raw-content">Top-level comment outside conversation block.</div>
      </div>
    </div>
  </body>
</html>
`;

export const groupedCommentHtml = `
<!doctype html>
<html>
  <head><title>#1324 - Example - Git</title></head>
  <body data-signed-user-name="brp">
    <div class="timeline-item comment first" id="issue-42956">
      <div class="content comment-container">
        <a class="author" href="/brp">brp</a>
        <time datetime="2026-05-20T23:08:12.000Z">May 20, 2026</time>
        <div class="raw-content">Initial PR description comment.</div>
      </div>
    </div>
    <div class="timeline-item-group" id="issuecomment-440612">
      <div class="timeline-item event">
        <span class="comment-text-line">requested changes</span>
      </div>
      <div class="timeline-item comment">
        <div class="content comment-container">
          <a class="author" href="/sil">sil</a>
          <time datetime="2026-05-26T16:48:43.000Z">May 26, 2026</time>
          <div class="raw-content">looks good to me just clear the dimensions check. and minor comments</div>
        </div>
      </div>
    </div>
    <div class="timeline-item-group" id="issuecomment-444328">
      <div class="timeline-item event">
        <span class="comment-text-line">requested changes</span>
      </div>
      <div class="timeline-item comment">
        <div class="content comment-container">
          <a class="author" href="/sil">sil</a>
          <time datetime="2026-06-03T13:41:50.000Z">Jun 3, 2026</time>
          <div class="raw-content">you have not addressed the comments on the refreshRecipientSnapshots</div>
        </div>
      </div>
    </div>
  </body>
</html>
`;

export const groupedCodeCommentHtml = `
<!doctype html>
<html>
  <head><title>#1324 - Example - Git</title></head>
  <body data-signed-user-name="brp">
    <div class="timeline-item-group" id="issuecomment-438210">
      <div class="timeline-item event">
        <span class="comment-text-line">reviewed</span>
      </div>
      <div class="timeline-item event code-comments-list">
        <div class="ui segments conversation-holder" id="conv-438209">
          <input name="path" value="backend/redx-domain/src/main/java/com/datahouse/redx/domain/entity/UserNotificationPreference.java" />
          <input name="line" value="59" />
          <a class="file-comment" href="/datahouse/project-REDX/pulls/1324/files#issuecomment-438205">backend/redx-domain/src/main/java/com/datahouse/redx/domain/entity/UserNotificationPreference.java</a>
          <button data-action="Resolve" data-comment-id="438205">Resolve conversation</button>
          <div class="comment code-comment" id="issuecomment-438205" data-comment-id="438205">
            <div class="content comment-container">
              <a class="author" href="/ddu">ddu</a>
              <time datetime="2026-05-21T06:48:37.000Z">May 21, 2026</time>
              <div class="raw-content">A comment inside a code-comment conversation.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="timeline-item-group">
      <div class="timeline-item event">
        <span class="comment-text-line">reviewed</span>
      </div>
      <div class="timeline-item comment">
        <div class="content comment-container">
          <a class="author" href="/sil">sil</a>
          <time datetime="2026-05-21T08:56:27.000Z">May 21, 2026</time>
          <div class="raw-content">we are missing also some job(or using current job) to delete stale preferences</div>
        </div>
      </div>
      <div class="timeline-item event code-comments-list">
        <div class="ui segments conversation-holder" id="conv-438315">
          <input name="path" value="backend/redx-app/src/main/java/com/datahouse/redx/service/ConfigurationFileService.java" />
          <input name="line" value="55" />
          <a class="file-comment" href="/datahouse/project-REDX/pulls/1324/files#issuecomment-438315">backend/redx-app/src/main/java/com/datahouse/redx/service/ConfigurationFileService.java</a>
          <button data-action="Resolve" data-comment-id="438315">Resolve conversation</button>
          <div class="comment code-comment" id="issuecomment-438315" data-comment-id="438315">
            <div class="content comment-container">
              <a class="author" href="/sil">sil</a>
              <time datetime="2026-05-21T08:56:27.000Z">May 21, 2026</time>
              <div class="raw-content">Another comment inside a code-comment conversation.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`;

export const nodeTypeHtml = `
<!doctype html>
<html>
  <head><title>#777 - Node Types - Git</title></head>
  <body data-signed-user-name="alice">
    <div class="ui segments conversation-holder" id="conv-change">
      <input name="path" value="src/change.js" />
      <input name="line" value="10" />
      <a class="file-comment" href="/acme/sample-repo/pulls/777/files#issuecomment-1001">src/change.js</a>
      <button data-action="Resolve" data-comment-id="1001">Resolve conversation</button>
      <div class="timeline-item comment" id="comment-1001" data-comment-id="1001">
        <div class="content comment-container">
          <a class="author" href="/bob">bob</a>
          <time datetime="2026-06-01T10:00:00.000Z">Jun 1, 2026</time>
          <div class="raw-content">Unresolved change comment.</div>
        </div>
      </div>
    </div>
    <div class="ui segments conversation-holder" id="conv-outdated">
      <input name="path" value="src/outdated.js" />
      <input name="line" value="20" />
      <a class="file-comment" href="/acme/sample-repo/pulls/777/files#issuecomment-2001">src/outdated.js</a>
      <button data-action="Resolve" data-comment-id="2001">Resolve conversation</button>
      <div class="ui label">Outdated</div>
      <div class="timeline-item comment" id="comment-2001" data-comment-id="2001">
        <div class="content comment-container">
          <a class="author" href="/bob">bob</a>
          <time datetime="2026-06-01T11:00:00.000Z">Jun 1, 2026</time>
          <div class="raw-content">Outdated change comment.</div>
        </div>
      </div>
    </div>
    <div class="ui segments conversation-holder" id="conv-resolved">
      <input name="path" value="src/resolved.js" />
      <input name="line" value="30" />
      <a class="file-comment" href="/acme/sample-repo/pulls/777/files#issuecomment-3001">src/resolved.js</a>
      <button data-action="Unresolve" data-comment-id="3001">Unresolve conversation</button>
      <div class="timeline-item comment" id="comment-3001" data-comment-id="3001">
        <div class="content comment-container">
          <a class="author" href="/alice">alice</a>
          <time datetime="2026-06-01T12:00:00.000Z">Jun 1, 2026</time>
          <div class="raw-content">Resolved change comment.</div>
        </div>
      </div>
    </div>
    <div class="timeline-item comment" id="comment-4001" data-comment-id="4001">
      <div class="content comment-container">
        <a class="author" href="/carol">carol</a>
        <time datetime="2026-06-01T13:00:00.000Z">Jun 1, 2026</time>
        <div class="raw-content">Standalone comment.</div>
      </div>
    </div>
  </body>
</html>
`;

export const debugOverlayHtml = `
<!doctype html>
<html>
  <head><title>#1324 - Example - Git</title></head>
  <body data-signed-user-name="brp">
    <div class="timeline-item-group" id="issuecomment-438210">
      <div class="timeline-item event">
        <span class="comment-text-line">reviewed</span>
      </div>
      <div class="timeline-item event code-comments-list">
        <div class="ui segments conversation-holder" id="conv-438209">
          <input name="path" value="backend/redx-domain/src/main/java/com/datahouse/redx/domain/entity/UserNotificationPreference.java" />
          <input name="line" value="59" />
          <a class="file-comment" href="/datahouse/project-REDX/pulls/1324/files#issuecomment-438205">backend/redx-domain/src/main/java/com/datahouse/redx/domain/entity/UserNotificationPreference.java</a>
          <button data-action="Resolve" data-comment-id="438205">Resolve conversation</button>
          <div class="comment code-comment" id="issuecomment-438205" data-comment-id="438205">
            <div class="content comment-container">
              <a class="author" href="/ddu">ddu</a>
              <time datetime="2026-05-21T06:48:37.000Z">May 21, 2026</time>
              <div class="raw-content">A comment inside a code-comment conversation.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`;

export const selectionReasonValues = new Set([
  "included_by_default",
  "included_resolved",
  "included_outdated",
  "included_last_comment_by_current_user",
  "included_manual_override",
]);

export const popupSettingsStorageKey = "gitea-pr-review-exporter-popup-settings-v2";

export function mockRect(node, { top, left, width, height }) {
  Object.defineProperty(node, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      top,
      left,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON() {
        return this;
      },
    }),
  });
}
