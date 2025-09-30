// background.js - Service worker to handle ChatGPT tab opening and pasting

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'sendToChatGPT') {
    handleSendToChatGPT(message.payload, message.autoPaste, message.autoSend);
    sendResponse({ success: true });
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
    const paragraph = promptBox?.querySelector('p');

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