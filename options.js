// Load saved settings or defaults
document.addEventListener('DOMContentLoaded', () => {
  // Load new settings, with legacy fallback for backwards compatibility
  chrome.storage.sync.get({
    startMessage: 'Please summarize this video transcript in 6-10 bullet points with a paragraph at the end answering the video title and main takeaways.',
    includeTimestamps: false,
    showMessage: true,
    autoCopy: false,
    targetService: 'chatgpt',
    // New generic flags
    autoRedirectToTarget: undefined,
    autoPasteInTarget: undefined,
    autoSendInTarget: undefined,
    // Legacy flags for migration
    autoRedirectToChatGPT: false,
    autoPasteInChatGPT: false,
    autoSendInChatGPT: false
  }, items => {
    const autoRedirectToTarget = (typeof items.autoRedirectToTarget === 'boolean')
      ? items.autoRedirectToTarget
      : !!items.autoRedirectToChatGPT;
    const autoPasteInTarget = (typeof items.autoPasteInTarget === 'boolean')
      ? items.autoPasteInTarget
      : !!items.autoPasteInChatGPT;
    const autoSendInTarget = (typeof items.autoSendInTarget === 'boolean')
      ? items.autoSendInTarget
      : !!items.autoSendInChatGPT;

    document.getElementById('startMessage').value = items.startMessage;
    document.getElementById('targetService').value = items.targetService || 'chatgpt';
    document.getElementById('includeTimestamps').checked = items.includeTimestamps;
    document.getElementById('showMessage').checked = items.showMessage;
    document.getElementById('autoCopy').checked = items.autoCopy;
    document.getElementById('autoRedirectToTarget').checked = autoRedirectToTarget;
    document.getElementById('autoPasteInTarget').checked = autoPasteInTarget;
    document.getElementById('autoSendInTarget').checked = autoSendInTarget;
  });

  // Save settings
  document.getElementById('save').addEventListener('click', () => {
    const startMessage = document.getElementById('startMessage').value;
    const targetService = document.getElementById('targetService').value || 'chatgpt';
    const includeTimestamps = document.getElementById('includeTimestamps').checked;
    const showMessage = document.getElementById('showMessage').checked;
    const autoCopy = document.getElementById('autoCopy').checked;
    const autoRedirectToTarget = document.getElementById('autoRedirectToTarget').checked;
    const autoPasteInTarget = document.getElementById('autoPasteInTarget').checked;
    const autoSendInTarget = document.getElementById('autoSendInTarget').checked;

    chrome.storage.sync.set({
      startMessage,
      targetService,
      includeTimestamps,
      showMessage,
      autoCopy,
      autoRedirectToTarget,
      autoPasteInTarget,
      autoSendInTarget
    }, () => {
      alert('Settings saved.');
    });
  });
});
