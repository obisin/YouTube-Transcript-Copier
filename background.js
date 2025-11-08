// background.js - Service worker to handle ChatGPT tab opening and pasting

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendToChatGPT') {
    // Legacy action for backwards compatibility
    handleSendToChatGPT(message.payload, message.autoPaste, message.autoSend);
    sendResponse({ success: true });
  } else if (message.action === 'sendToTarget') {
    handleSendToTarget(message.payload, message.autoPaste, message.autoSend, message.targetService || 'chatgpt')
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error('sendToTarget error:', err);
        sendResponse({ success: false, error: String(err) });
      });
  } else if (message.action === 'injectTimedtextHook') {
    const tabId = sender?.tab?.id;
    if (tabId) {
      injectTimedtextHook(tabId)
        .then(() => sendResponse({ success: true }))
        .catch(err => {
          console.error('injectTimedtextHook error:', err);
          sendResponse({ success: false, error: String(err) });
        });
    } else {
      sendResponse({ success: false, error: 'No tab id' });
    }
  }
  return true;
});

async function handleSendToChatGPT(payload, autoPaste, autoSend) {
  try {
    const chatGPTUrl = 'https://chatgpt.com/';

    // Get the current active tab
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Navigate current tab to ChatGPT
    await chrome.tabs.update(currentTab.id, { url: chatGPTUrl });

    // Wait for page to load
    await waitForTabLoad(currentTab.id);

    // Inject script to paste and submit if enabled
    if (autoPaste || autoSend) {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: pasteAndSubmit,
        args: [payload, autoPaste, autoSend]
      });
    }
  } catch (error) {
    console.error('Error sending to ChatGPT:', error);
  }
}

async function handleSendToTarget(payload, autoPaste, autoSend, targetService) {
  const service = (targetService || 'chatgpt').toLowerCase();
  const targetUrl = service === 'claude'
    ? 'https://claude.ai/new'
    : (service === 'gemini'
      ? 'https://gemini.google.com/app'
      : 'https://chatgpt.com/');

  try {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.update(currentTab.id, { url: targetUrl });
    await waitForTabLoad(currentTab.id);

    if (autoPaste || autoSend) {
      if (service === 'claude') {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: pasteAndSubmitClaude,
          args: [payload, autoPaste, autoSend]
        });
      } else if (service === 'gemini') {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: pasteAndSubmitGemini,
          args: [payload, autoPaste, autoSend]
        });
      } else {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: pasteAndSubmit,
          args: [payload, autoPaste, autoSend]
        });
      }
    }
  } catch (error) {
    console.error('Error sending to target:', error);
    throw error;
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        // Additional delay to ensure page is fully interactive
        setTimeout(resolve, 2000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// This function runs in the ChatGPT page context
function pasteAndSubmit(text, autoPaste, autoSend) {
  // Wait for the prompt box to be available
  const checkPromptBox = setInterval(() => {
    const promptBox = document.querySelector('#prompt-textarea');
    const paragraph = promptBox ? promptBox.querySelector('p') : null;

    if (promptBox && paragraph) {
      clearInterval(checkPromptBox);

      // Only paste if autoPaste is enabled
      if (autoPaste) {
        // Focus the prompt box
        promptBox.focus();

        // Clear existing content
        paragraph.innerHTML = '';

        // Create text node and append
        const textNode = document.createTextNode(text);
        paragraph.appendChild(textNode);

        // Trigger input events for ProseMirror
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        });

        promptBox.dispatchEvent(inputEvent);
        paragraph.dispatchEvent(inputEvent);

        // Additional events to ensure React/ProseMirror detects the change
        const changeEvent = new Event('change', { bubbles: true });
        promptBox.dispatchEvent(changeEvent);
      }

      // Only click send button if autoSend is enabled
      if (autoSend) {
        setTimeout(() => {
          const sendButton = document.querySelector('#composer-submit-button');

          if (sendButton) {
            // Try multiple click methods
            sendButton.click();

            // Fallback: dispatch mouse events
            const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
            const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true });
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });

            sendButton.dispatchEvent(mouseDownEvent);
            sendButton.dispatchEvent(mouseUpEvent);
            sendButton.dispatchEvent(clickEvent);
          }
        }, autoPaste ? 1500 : 100);
      }
    }
  }, 500);

  // Timeout after 15 seconds
  setTimeout(() => clearInterval(checkPromptBox), 15000);
}

// Claude injector
function pasteAndSubmitClaude(text, autoPaste, autoSend) {
  const tryFindInput = () =>
    document.querySelector('textarea, div[contenteditable="true"][role="textbox"], div[contenteditable="true"]');

  const tryFindSendButton = () =>
    document.querySelector('button[type="submit"], button[aria-label*="Send" i], [data-testid="send-button"]');

  const fillTextarea = (el, value) => {
    el.focus();
    el.value = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const fillContentEditable = (el, value) => {
    el.focus();
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('delete');
      document.execCommand('insertText', false, value);
    } catch {}
    if ((el.textContent || '').trim() !== (value || '').trim()) {
      el.textContent = value;
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const interval = setInterval(() => {
    const input = tryFindInput();
    if (!input) return;
    clearInterval(interval);

    if (autoPaste) {
      if (input.tagName === 'TEXTAREA') fillTextarea(input, text);
      else fillContentEditable(input, text);
    }

    if (autoSend) {
      setTimeout(() => {
        const btn = tryFindSendButton();
        if (btn) {
          btn.click();
          const evts = ['mousedown', 'mouseup', 'click'];
          evts.forEach(t => btn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true })));
        }
      }, autoPaste ? 1200 : 200);
    }
  }, 500);

  setTimeout(() => clearInterval(interval), 15000);
}

// Gemini injector
function pasteAndSubmitGemini(text, autoPaste, autoSend) {
  const tryFindInput = () =>
    document.querySelector('textarea, div[contenteditable="true"][role="textbox"], div[contenteditable="true"]');

  const tryFindSendButton = () =>
    document.querySelector('button[aria-label="Send"], button[aria-label*="Send" i], button[type="submit"]');

  const fillTextarea = (el, value) => {
    el.focus();
    el.value = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const fillContentEditable = (el, value) => {
    el.focus();
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('delete');
      document.execCommand('insertText', false, value);
    } catch {}
    if ((el.textContent || '').trim() !== (value || '').trim()) {
      el.textContent = value;
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value, inputType: 'insertText' }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const interval = setInterval(() => {
    const input = tryFindInput();
    if (!input) return;
    clearInterval(interval);

    if (autoPaste) {
      if (input.tagName === 'TEXTAREA') fillTextarea(input, text);
      else fillContentEditable(input, text);
    }

    if (autoSend) {
      setTimeout(() => {
        const btn = tryFindSendButton();
        if (btn) {
          btn.click();
          const evts = ['mousedown', 'mouseup', 'click'];
          evts.forEach(t => btn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true })));
        }
      }, autoPaste ? 1200 : 200);
    }
  }, 500);

  setTimeout(() => clearInterval(interval), 15000);
}

// Download helpers removed (reverted)

async function injectTimedtextHook(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      try {
        const W = window;
        if (W.__ytcHooked) return;
        W.__ytcHooked = true;
        const F = W.fetch;
        if (typeof F === 'function') {
          W.fetch = function(...args) {
            try {
              let u = args[0];
              if (u && typeof u !== 'string') u = u.url || String(u);
              if (u && String(u).includes('/api/timedtext')) {
                W.postMessage({ type: 'ytc_timedtext_url', url: String(u) }, '*');
              }
            } catch {}
            return F.apply(this, args);
          };
        }
        const XO = W.XMLHttpRequest && W.XMLHttpRequest.prototype && W.XMLHttpRequest.prototype.open;
        const XS = W.XMLHttpRequest && W.XMLHttpRequest.prototype && W.XMLHttpRequest.prototype.send;
        if (XO && XS) {
          W.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            try { this.__ytc_url = String(url || ''); } catch {}
            return XO.call(this, method, url, ...rest);
          };
          W.XMLHttpRequest.prototype.send = function(...args) {
            try {
              const u = this.__ytc_url || '';
              if (u.includes('/api/timedtext')) {
                W.postMessage({ type: 'ytc_timedtext_url', url: u }, '*');
              }
            } catch {}
            return XS.apply(this, args);
          };
        }
      } catch (e) {}
    }
  });
}
