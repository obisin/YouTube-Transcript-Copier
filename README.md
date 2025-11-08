# YouTube Transcript Copier

A powerful Chrome extension to extract YouTube video transcripts with a multi-layered approach, format them, and optionally redirect to ChatGPT, Claude, or Gemini for analysis — with auto‑paste and auto‑send if desired.

![Demonstration GIF](https://via.placeholder.com/800x400.png?text=Extension+Demonstration+GIF)

## Key Features

- **Robust Transcript Extraction**: The extension uses a sophisticated multi-step process to ensure it can always get a transcript if one is available:
    1.  **UI Scraping**: It first tries to get the transcript by automating the YouTube interface, just like a user would.
    2.  **Caption Track Fallback**: If the UI method fails, it intelligently fetches the raw caption tracks from YouTube's internal data (`ytInitialPlayerResponse`) or by directly calling the `timedtext` API.
    3.  **Network Capture**: As a final resort, it can even capture the transcript URL directly from the network requests made by the YouTube player.
- **Clipboard‑first**:
    - The transcript (with your starting message and video title) is always copied to your clipboard. You can paste it anywhere — Docs, Notes, Notion, Slack, etc.
- **Seamless Redirect (ChatGPT/Claude/Gemini)**:
    -   **Auto-Redirect**: Automatically opens your selected destination after copying the transcript.
    -   **Auto-Paste**: Pastes the formatted transcript into the destination prompt.
    -   **Auto-Send**: Clicks the send button for you.
- **Highly Customizable**:
    -   **Custom Prompt**: Define your own starting message to guide the AI's analysis.
    -   **Timestamp Control**: Optionally include or exclude timestamps in the output.
    -   **Flexible Automation**: Enable or disable any of the automation features (auto-copy, auto-redirect, auto-paste, auto-send) to fit your workflow.
- **Clean Output Format**: The copied text is neatly formatted with your custom message, the video title, and the full transcript, ready for immediate use.

## Installation

1.  Download or clone this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" in the top right.
4.  Click "Load unpacked" and select the extension folder.
5.  Navigate to any YouTube video to see the red "Copy Transcript" button.

## Usage

1.  Go to any YouTube video.
2.  Click the red "Copy Transcript" button that appears in the top-right.
3.  The extension will automatically find and load the transcript.
4.  The transcript is copied to your clipboard. Depending on your options, it may also auto‑redirect to ChatGPT/Claude/Gemini, auto‑paste into the prompt, and auto‑send.

Tip: If you prefer manual control, leave auto‑redirect/paste/send off. Just paste the clipboard contents wherever you want.

## Customization Options

You can customize the extension's behavior by right-clicking the extension icon and selecting "Options":

-   **Starting message**: A custom message to be included with the transcript.
-   **Redirect to**: Choose ChatGPT, Claude, or Gemini for optional redirect.
-   **Include timestamps**: Add timestamps to each line of the transcript.
-   **Show confirmation messages**: Display a confirmation message after copying the transcript.
-   **Auto-copy**: Automatically copy the transcript after it's loaded (enables one‑click operation).
-   **Auto-redirect to selection**: Automatically redirect after copying.
-   **Auto-paste transcript into prompt**: Automatically paste into the destination prompt.
-   **Auto-press send button**: Automatically press the send button.

## Technical Details

-   **Manifest Version**: 3
-   **Core Logic (`content_script.js`)**: Injected into YouTube watch pages to handle button creation, UI interaction, and the multi-layered transcript extraction process.
-   **Service Worker (`background.js`)**: Manages redirect/paste/send for ChatGPT, Claude, and Gemini.
-   **Permissions**: `storage` (for settings), `clipboardWrite`, `activeTab`, `scripting`, and `tabs`.
-   **Host Permissions**: `*://*.youtube.com/*`, `https://chatgpt.com/*`, `https://claude.ai/*`, `https://gemini.google.com/*`.

## Troubleshooting

-   **"Chrome storage not available" error**: This warning may appear briefly during extension loading but doesn't affect functionality. The extension will use default settings.
-   **Transcript button not found**: If the extension fails to open the transcript, manually click YouTube's "Show transcript" button first, then use the extension.
-   **Page scrolling after auto-open**: This is normal behavior as the extension opens YouTube's description panel to access the transcript button.
-   **Auto-send not working**: Make sure all three checkboxes are enabled: auto-redirect, auto-paste, and auto-press send.
-   **Auto-paste fails or you’re not signed in**: Your transcript is already on the clipboard — just click the prompt box and press `Ctrl/Cmd+V`.

## Privacy

This extension runs entirely in your browser. It does not collect or store any of your data. All settings are stored locally on your computer. The extension interacts with YouTube and (optionally) ChatGPT/Claude/Gemini to provide its functionality.

## Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue.

## License

This project is open source and available under the MIT License.
