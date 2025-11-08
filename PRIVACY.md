# Privacy Policy — YouTube Transcript Copier

Effective date: 2025-11-08

This Chrome extension helps you copy the transcript from the current YouTube video and, if you choose, open ChatGPT, Claude, or Gemini to paste and submit that transcript for analysis. It runs locally in your browser and does not send any data to the developer.

## Summary
- No data collection, sale, or sharing with the developer or third parties.
- All transcript handling happens locally in your browser.
- Only lightweight settings are stored via Chrome Sync (optional, local to your account).
- No remote code, analytics, or tracking libraries are used.

## What the extension does
When you click the extension’s button on a YouTube watch page, it assembles the video’s transcript (when available) and formats it along with your configurable “starting message.” It then:
- Copies the text to your clipboard; and
- If you enable it, opens ChatGPT, Claude, or Gemini in your active tab and pastes the text into their prompt box. You may optionally auto‑press the send button.

## Data collection
The extension does not collect, transmit, sell, or share any personal information or browsing data. It does not use analytics or tracking. The transcript text is processed in memory and is not sent to any server controlled by the developer.

## Local storage
The extension uses Chrome’s storage to save preferences such as:
- Starting message
- Whether to include timestamps
- Whether to auto‑copy, auto‑redirect, auto‑paste, and auto‑send
- Selected destination (ChatGPT, Claude, or Gemini)

These settings are stored via `chrome.storage.sync` (or `chrome.storage.local` as decided by your browser) and remain tied to your browser profile. The extension does not store transcript contents or other page data.

## Permissions and how they are used
- `storage`: Save user preferences listed above.
- `clipboardWrite`: Copy the formatted transcript to your clipboard after you trigger the action (or when auto‑copy is enabled).
- `activeTab`: Act on the current tab after user interaction (open the selected AI site and time script injection safely).
- `scripting`: Inject small helper functions that are bundled with the extension to read captions on YouTube and to paste into the AI prompt box. No remote scripts are used.
- `tabs`: Query/update the current tab and observe when it finishes loading so helper code runs at the right time.

## Host permissions and scope
- `*://*.youtube.com/*`: Read the current video’s transcript/captions to assemble text locally. In some cases, the extension requests YouTube’s captions endpoint (e.g., `/api/timedtext`) to retrieve available caption data.
- `https://chatgpt.com/*` and `https://chat.openai.com/*`: If enabled, open the page and paste the transcript into the prompt.
- `https://claude.ai/*`: Same as above for Claude.
- `https://gemini.google.com/*`: Same as above for Gemini.

The content script runs only on YouTube watch pages. AI sites are opened in your active tab only when you choose to redirect.

## Remote code
No remote code is used. All code is included in the extension package. The extension does not load external scripts, use `eval`, or dynamically fetch executable code.

## Third‑party services
If you choose to open ChatGPT, Claude, or Gemini, your transcript text is entered into those services within your own browser session. Their handling of that text is governed by their respective privacy policies and terms. The extension is not affiliated with OpenAI, Anthropic, or Google.

## Data retention and user control
The extension does not retain transcript contents. You can remove stored preferences at any time by removing the extension data (e.g., via Chrome settings) or uninstalling the extension.

## Changes to this policy
If this policy changes, the updated version will be published with the extension and in this file.

## Contact
Questions or concerns? Please open an issue in the repository.

