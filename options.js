// Load saved settings or defaults
document.addEventListener('DOMContentLoaded', () => {
chrome.storage.sync.get({
  startMessage: 'Please summarize this video transcript in 6-10 bullet points with a paragraph at the end answering the video title and main takeaways.',
  includeTimestamps: false,
  showMessage: true,
  autoCopy: false,
  autoRedirectToChatGPT: false,
  autoPasteInChatGPT: false,
  autoSendInChatGPT: false
}, items => {
  document.getElementById('startMessage').value = items.startMessage;
  document.getElementById('includeTimestamps').checked = items.includeTimestamps;
  document.getElementById('showMessage').checked = items.showMessage;
  document.getElementById('autoCopy').checked = items.autoCopy;
  document.getElementById('autoRedirectToChatGPT').checked = items.autoRedirectToChatGPT;
  document.getElementById('autoPasteInChatGPT').checked = items.autoPasteInChatGPT;
  document.getElementById('autoSendInChatGPT').checked = items.autoSendInChatGPT;
});

// In the save click handler:
document.getElementById('save').addEventListener('click', () => {
  const startMessage = document.getElementById('startMessage').value;
  const includeTimestamps = document.getElementById('includeTimestamps').checked;
  const showMessage = document.getElementById('showMessage').checked;
  const autoCopy = document.getElementById('autoCopy').checked;
  const autoRedirectToChatGPT = document.getElementById('autoRedirectToChatGPT').checked;
  const autoPasteInChatGPT = document.getElementById('autoPasteInChatGPT').checked;
  const autoSendInChatGPT = document.getElementById('autoSendInChatGPT').checked;
  chrome.storage.sync.set({
    startMessage,
    includeTimestamps,
    showMessage,
    autoCopy,
    autoRedirectToChatGPT,
    autoPasteInChatGPT,
    autoSendInChatGPT
  }, () => {
    alert('Settings saved.');
  });
});
});
