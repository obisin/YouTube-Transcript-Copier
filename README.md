# YouTube Transcript Copier

A simple Chrome extension that automatically extracts YouTube video transcripts and copies them to your clipboard with customizable formatting for AI analysis.

## Features

- **Auto-open transcripts**: Automatically opens YouTube's transcript panel if not already visible
- **One-click or two-click operation**: Configurable auto-copy or manual confirmation
- **Timestamp inclusion**: Optional timestamps in transcript output
- **Customizable prompt**: Set your own starting message for AI analysis
- **Clean formatting**: Formats output with video title and transcript for easy AI processing

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. Navigate to any YouTube video to see the red "Copy Transcript" button

## Usage

### Basic Operation
1. Go to any YouTube video
2. Click the red "Copy Transcript" button that appears in the top-right
3. The extension will automatically open the transcript panel if needed
4. Depending on your settings, it will either auto-copy or require a second click

### Settings
Access settings by right-clicking the extension icon and selecting "Options":

- **Starting message**: Customize the prompt that precedes your transcript (default optimized for AI summarization)
- **Include timestamps**: Add `[timestamp]` markers to each transcript segment
- **Show confirmation messages**: Display status messages below the button
- **Auto-copy**: Enable single-click operation (copies immediately after loading transcript)

## Output Format

The extension copies text in this format:

```
[Your custom starting message]
Title: [Video Title]
Transcript:
[Transcript content with optional timestamps]
```

Default starting message is optimized for AI analysis requesting bullet point summaries and takeaways.

## Technical Details

- **Manifest Version**: 3
- **Permissions**: storage, clipboardWrite, activeTab, scripting
- **Target**: YouTube watch pages (`*://*.youtube.com/watch*`)
- **Auto-injection**: Button persists through YouTube's SPA navigation

## Troubleshooting

### "Chrome storage not available" error
This warning appears briefly during extension loading but doesn't affect functionality. The extension falls back to default settings.

### Transcript button not found
If auto-opening fails, manually click YouTube's "Show transcript" button first, then use the extension.

### Page scrolling after auto-open
This is normal behaviour when the extension opens YouTube's description panel to access the transcript button.

## File Structure

```
├── manifest.json          # Extension configuration
├── content_script.js       # Main extension logic
├── options.html           # Settings page interface
├── options.js             # Settings page functionality
└── README.md             # This file
```

## Development

The extension uses:
- **Content script injection** for YouTube page interaction
- **Chrome Storage API** for settings persistence
- **Mutation observers** for SPA navigation compatibility
- **Async/await patterns** for transcript loading

## License

Open source - feel free to modify and redistribute.

## Contributing

Issues and pull requests welcome. When reporting bugs, include:
- Chrome version
- Extension version
- YouTube video URL (if relevant)
- Console error messages