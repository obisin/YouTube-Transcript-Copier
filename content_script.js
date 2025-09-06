// content_script.js
(function() {
  const BUTTON_ID = 'copy-transcript-btn';
  const MSG_ID    = 'copy-transcript-msg';

  let bufferedTranscript = null;

  // Injects the button + message container
  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const container = document.createElement('div');
    Object.assign(container.style, {
      position:   'fixed',
      top:        '80px',
      right:      '20px',
      zIndex:     1000,
      textAlign:  'center'
    });

    const btn = document.createElement('button');
    btn.id          = BUTTON_ID;
    btn.textContent = 'Copy Transcript';
    Object.assign(btn.style, {
      padding:      '8px 12px',
      background:   '#FF0000',
      color:        '#fff',
      border:       'none',
      borderRadius: '4px',
      cursor:       'pointer'
    });
    btn.addEventListener('click', onButtonClick);

    const msg = document.createElement('div');
    msg.id = MSG_ID;
    Object.assign(msg.style, {
      marginTop:       '4px',
      color:           '#fff',
      border:          '1px solid #000',
      padding:         '4px',
      backgroundColor: 'transparent'
    });

    container.appendChild(btn);
    container.appendChild(msg);
    document.body.appendChild(container);
  }

  // Updates the text below the button
  function setMessage(text, show) {
    const msg = document.getElementById(MSG_ID);
    if (msg) msg.textContent = show ? text : '';
  }

  // Two-step click handler:
  // 1st click = scrape & buffer (after you open transcript panel)
  // 2nd click = copy to clipboard using your settings
// Add these helper functions before onButtonClick()
function openDescriptionPanel() {
  const descButton = document.querySelector('#description-inline-expander button, #expand');
  if (descButton && !descButton.getAttribute('hidden')) {
    descButton.click();
    return true;
  }
  return false;
}

function findTranscriptButton() {
  return document.querySelector('button[aria-label="Show transcript"]');
}

async function waitForTranscriptLoad(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const panel = document.querySelector('#segments-container');
    if (panel && panel.children.length > 0) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

// Modified onButtonClick function
async function onButtonClick() {
  // Safety check for chrome.storage and get settings
  let startMessage, includeTimestamps, showMessage, autoCopy;
  if (!chrome?.storage?.sync) {
    console.warn('Chrome storage not available, using defaults');
    startMessage = 'Please summarize this video transcript in 6-10 bullet points with a paragraph at the end answering the video title and main takeaways.';
    includeTimestamps = false;
    showMessage = true;
    autoCopy = false;
  } else {
    const settings = await chrome.storage.sync.get({
      startMessage: 'Please summarize this video transcript in 6-10 bullet points with a paragraph at the end answering the video title and main takeaways.',
      includeTimestamps: false,
      showMessage: true,
      autoCopy: false
    });
    ({ startMessage, includeTimestamps, showMessage, autoCopy } = settings);
  }

  // Step 1: scrape if not buffered
  if (bufferedTranscript === null) {
    let panel = document.querySelector('#segments-container');

    // NEW: Auto-open attempt if panel not found
    if (!panel) {
      setMessage('Opening transcript...', showMessage);

      // Try to open description panel
      openDescriptionPanel();
      await new Promise(resolve => setTimeout(resolve, 300));

      // Try to click transcript button
      const transcriptBtn = findTranscriptButton();
      if (transcriptBtn) {
        transcriptBtn.click();
        const loaded = await waitForTranscriptLoad();
        if (!loaded) {
          setMessage('Transcript failed to load. Try manually.', showMessage);
          return;
        }
        panel = document.querySelector('#segments-container');
      } else {
        setMessage('Transcript button not found. Please open manually.', showMessage);
        return;
      }
    }

    // Rest of your existing logic unchanged
    const segments = Array.from(panel.querySelectorAll('ytd-transcript-segment-renderer'));
    if (!segments.length) {
      setMessage('No transcript segments found.', showMessage);
      return;
    }

    bufferedTranscript = segments
      .map(seg => {
        const textElement = seg.querySelector('yt-formatted-string');
        const text = textElement?.textContent?.trim() || '';

        if (includeTimestamps) {
          const timeElement = seg.querySelector('.segment-timestamp');
          const time = timeElement?.textContent?.trim() || '';
          return `[${time}] ${text}`;
        }
        return text;
      })
      .join(' ');
    if (autoCopy) {
      setMessage('Transcript loaded. Copying...', showMessage);
      // Don't return - let execution continue to Step 2
    } else {
      setMessage('Transcript loaded. Click again to copy.', showMessage);
      return;
    }
  }

  // Step 2: copy buffered transcript (unchanged)
  const title = document.querySelector('#title > h1 > yt-formatted-string')?.textContent.trim() || '';
  const payload = `${startMessage}
Title: ${title}
Transcript:
${bufferedTranscript}`;

  try {
    await navigator.clipboard.writeText(payload);
    setMessage('Transcript copied to clipboard.', showMessage);
  } catch (e) {
    console.error('Clipboard error:', e);
    setMessage('Failed to copy transcript.', showMessage);
  }
  bufferedTranscript = null;
}

  // Initialize the button and re-inject on SPA nav
  createButton();
  new MutationObserver(createButton).observe(document.body, { childList: true, subtree: true });
})();
