// Load saved settings or defaults
document.addEventListener('DOMContentLoaded', () => {
chrome.storage.sync.get({
  startMessage: 'Please summarize this video transcript in 6-10 bullet points with a paragraph at the end answering the video title and main takeaways.',
  includeTimestamps: false,
  showMessage: true,
  autoCopy: false
}, items => {
  document.getElementById('startMessage').value = items.startMessage;
  document.getElementById('includeTimestamps').checked = items.includeTimestamps;
  document.getElementById('showMessage').checked = items.showMessage;
  document.getElementById('autoCopy').checked = items.autoCopy;
});

// In the save click handler:
document.getElementById('save').addEventListener('click', () => {
  const startMessage = document.getElementById('startMessage').value;
  const includeTimestamps = document.getElementById('includeTimestamps').checked;
  const showMessage = document.getElementById('showMessage').checked;
  const autoCopy = document.getElementById('autoCopy').checked;
  chrome.storage.sync.set({ startMessage, includeTimestamps, showMessage, autoCopy }, () => {
    alert('Settings saved.');
  });
});
});