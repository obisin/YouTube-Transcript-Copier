// content_script.js
(function() {
  const BUTTON_ID = 'copy-transcript-btn';
  const MSG_ID    = 'copy-transcript-msg';

  let bufferedTranscript = null;
  const capturedTimedtextUrls = new Set();

  // Collect timedtext URLs posted from page-context hook early
  try {
    window.addEventListener('message', (ev) => {
      try {
        if (ev.source !== window) return;
        const d = ev.data;
        if (d && d.type === 'ytc_timedtext_url' && d.url) {
          capturedTimedtextUrls.add(String(d.url));
        }
      } catch {}
    }, false);
  } catch {}

  // ========== CC/Subtitle helpers (primary path) ==========
  async function getCaptionTracksFromPage(maxAttempts = 8, delayMs = 400) {
    // Try to parse ytInitialPlayerResponse from inline scripts to avoid CSP/injection issues
    const extractPlayerResponse = () => {
      const scripts = Array.from(document.scripts);
      for (const s of scripts) {
        const txt = s.textContent || '';
        if (!txt || txt.indexOf('ytInitialPlayerResponse') === -1) continue;
        const idx = txt.indexOf('ytInitialPlayerResponse');
        const braceStart = txt.indexOf('{', idx);
        if (braceStart === -1) continue;
        let i = braceStart;
        let depth = 0;
        let inStr = false;
        let esc = false;
        for (; i < txt.length; i++) {
          const ch = txt[i];
          if (inStr) {
            if (esc) { esc = false; continue; }
            if (ch === '\\') { esc = true; continue; }
            if (ch === '"') { inStr = false; }
            continue;
          }
          if (ch === '"') { inStr = true; continue; }
          if (ch === '{') depth++;
          if (ch === '}') {
            depth--;
            if (depth === 0) {
              const jsonStr = txt.slice(braceStart, i + 1);
              try {
                return JSON.parse(jsonStr);
              } catch (e) {
                // parsing failed, try next script
              }
            }
          }
        }
      }
      return null;
    };

    const extractCaptionTracksArray = () => {
      const scripts = Array.from(document.scripts);
      for (const s of scripts) {
        const txt = s.textContent || '';
        const keyIdx = txt.indexOf('"captionTracks"');
        if (keyIdx === -1) continue;
        const arrStart = txt.indexOf('[', keyIdx);
        if (arrStart === -1) continue;
        let i = arrStart, depth = 0, inStr = false, esc = false;
        for (; i < txt.length; i++) {
          const ch = txt[i];
          if (inStr) {
            if (esc) { esc = false; continue; }
            if (ch === '\\') { esc = true; continue; }
            if (ch === '"') { inStr = false; }
            continue;
          }
          if (ch === '"') { inStr = true; continue; }
          if (ch === '[') depth++;
          if (ch === ']') {
            depth--;
            if (depth === 0) {
              const jsonStr = txt.slice(arrStart, i + 1);
              try {
                return JSON.parse(jsonStr);
              } catch (e) {
                // fall through
              }
            }
          }
        }
      }
      return null;
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let pr = extractPlayerResponse();
      // Fallback: try Polymer data on ytd-watch-flexy (read-only)
      if (!pr) {
        try {
          const flexy = document.querySelector('ytd-watch-flexy');
          const data = flexy && flexy.__data && flexy.__data.playerResponse ? flexy.__data.playerResponse : null;
          if (data) pr = data;
        } catch (e) {
          // ignore
        }
      }
      let tracks = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer ? pr.captions.playerCaptionsTracklistRenderer.captionTracks : null;
      if (!tracks || !tracks.length) {
        const arr = extractCaptionTracksArray();
        if (arr && arr.length) tracks = arr;
      }
      if (tracks && tracks.length) return tracks;
      await new Promise(r => setTimeout(r, delayMs));
    }
    return null;
  }

  function chooseBestCaptionTrack(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) return null;

    const lang = (navigator.language || '').toLowerCase();
    const langBase = lang.split('-')[0];

    const manual = tracks.filter(t => t.kind !== 'asr');
    const auto = tracks.filter(t => t.kind === 'asr');

    const score = (t) => {
      const lc = (t.languageCode || '').toLowerCase();
      let s = 0;
      if (lc === lang) s += 4;
      if (langBase && lc.startsWith(langBase)) s += 3;
      if (t.name && t.name.simpleText && /english/i.test(t.name.simpleText)) s += 2;
      if (t.isTranslatable) s += 1; // might enable tlang later
      return s;
    };

    const pickFrom = (arr) => arr.sort((a, b) => score(b) - score(a))[0] || null;
    return pickFrom(manual) || pickFrom(auto) || tracks[0] || null;
  }

  function buildVttUrl(baseUrl) {
    try {
      const u = new URL(baseUrl);
      u.searchParams.set('fmt', 'vtt');
      return u.toString();
    } catch {
      return baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'fmt=vtt';
    }
  }

  function appendParam(urlStr, key, value) {
    try {
      const u = new URL(urlStr);
      u.searchParams.set(key, value);
      return u.toString();
    } catch {
      const sep = urlStr.includes('?') ? '&' : '?';
      return urlStr + sep + encodeURIComponent(key) + '=' + encodeURIComponent(value);
    }
  }

  async function fetchVtt(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch captions: ' + res.status);
    return await res.text();
  }

  function decodeHtmlEntities(str) {
    const el = document.createElement('textarea');
    el.innerHTML = str;
    return el.value;
  }

  function vttToText(vtt, includeTimestamps) {
    if (!vtt) return '';
    const lines = vtt.split(/\r?\n/);
    const out = [];
    let buf = [];
    let curStart = '';
    const timeRe = /^(\d{1,2}:)?\d{2}:\d{2}\.\d{3} --> /;

    const flush = () => {
      if (buf.length === 0) return;
      const textLine = decodeHtmlEntities(buf.join(' ').replace(/<[^>]+>/g, '').trim());
      if (textLine) {
        out.push(includeTimestamps && curStart ? `[${curStart}] ${textLine}` : textLine);
      }
      buf = [];
      curStart = '';
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) {
        flush();
        continue;
      }
      if (timeRe.test(line)) {
        const start = line.split(' --> ')[0].trim();
        curStart = start.replace(/\.(\d{3})$/, ''); // drop ms for compactness
        continue;
      }
      if (/^WEBVTT/.test(line) || /^\d+$/.test(line)) {
        continue; // header or cue number
      }
      buf.push(line);
    }
    flush();
    return out.join(' ');
  }

  function secondsToClock(s) {
    const total = Math.max(0, Math.floor(Number(s) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  function srv3XmlToText(xmlStr, includeTimestamps) {
    try {
      const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
      // srv3 structure: <timedtext><body><p t="..." d="..."><s>text</s>...</p>...</body></timedtext>
      const ps = Array.from(doc.getElementsByTagName('p'));
      if (!ps.length) return '';
      const parts = [];
      for (const p of ps) {
        const startMs = Number(p.getAttribute('t') || '');
        // Combine <s> fragments inside this <p>
        const segs = Array.from(p.getElementsByTagName('s'));
        let t = segs.map(s => s.textContent || '').join('');
        if (!segs.length) t = p.textContent || '';
        t = decodeHtmlEntities(t).replace(/\s+/g, ' ').trim();
        if (!t) continue;
        if (includeTimestamps && !Number.isNaN(startMs)) {
          parts.push(`[${secondsToClock(Math.floor(startMs/1000))}] ${t}`);
        } else {
          parts.push(t);
        }
      }
      return parts.join(' ');
    } catch {
      return '';
    }
  }

  function xmlTextToText(xmlStr, includeTimestamps) {
    // Default XML: <transcript><text start="0" dur="2.34">Hello</text>...</transcript>
    try {
      const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');
      const nodes = Array.from(doc.getElementsByTagName('text'));
      if (!nodes.length) return '';
      const parts = [];
      for (const n of nodes) {
        const start = Number(n.getAttribute('start') || '');
        const t = decodeHtmlEntities(n.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t) continue;
        if (includeTimestamps && !Number.isNaN(start)) {
          parts.push(`[${secondsToClock(Math.floor(start))}] ${t}`);
        } else {
          parts.push(t);
        }
      }
      return parts.join(' ');
    } catch {
      return '';
    }
  }

  function json3ToText(jsonStr, includeTimestamps) {
    try {
      const data = JSON.parse(jsonStr);
      const events = Array.isArray(data?.events) ? data.events : [];
      if (!events.length) return '';
      const parts = [];
      for (const e of events) {
        const segs = Array.isArray(e?.segs) ? e.segs : [];
        const text = segs.map(s => s?.utf8 || '').join('').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        if (includeTimestamps && typeof e.tStartMs === 'number') {
          parts.push(`[${secondsToClock(Math.floor(e.tStartMs/1000))}] ${text}`);
        } else {
          parts.push(text);
        }
      }
      return parts.join(' ');
    } catch {
      return '';
    }
  }

  function ensurePlayerCcOn() {
    try {
      const btn = document.querySelector('.ytp-subtitles-button');
      if (btn && btn.getAttribute('aria-pressed') === 'false') {
        btn.click();
      }
    } catch {}
  }

  // no playback nudge in working baseline


  async function loadCaptionsText(includeTimestamps) {
    try {
      // 1) Try in-page caption tracks
      let tracks = await getCaptionTracksFromPage(12, 500);
      if (!tracks || !tracks.length) {
        // 2) Fallback: timedtext list API (works even if UI hides transcript)
        const vid = getCurrentVideoId();
        if (vid) {
          tracks = await getCaptionTracksViaApi(vid);
        }
      }
      if (tracks && tracks.length) {
        const track = chooseBestCaptionTrack(tracks);
        if (track && track.baseUrl) {
          const userBase = (navigator.language || '').split('-')[0].toLowerCase();
          const trackLang = (track.languageCode || '').toLowerCase();
          const wantTranslate = !!(userBase && trackLang && userBase !== trackLang && track.isTranslatable);

          // 1) Try JSON3 (most robust)
          let url = track.baseUrl;
          if (wantTranslate) url = appendParam(url, 'tlang', userBase);
          url = appendParam(url, 'fmt', 'json3');
          try {
            const json = await fetchText(url);
            const text = json3ToText(json, includeTimestamps).trim();
            if (text) return text;
          } catch {}

          // 2) Try VTT
          url = track.baseUrl;
          if (wantTranslate) url = appendParam(url, 'tlang', userBase);
          url = appendParam(url, 'fmt', 'vtt');
          try {
            const vtt = await fetchVtt(url);
            const text = vttToText(vtt, includeTimestamps).trim();
            if (text) return text;
          } catch {}

          // 3) Try default XML (<text start> nodes)
          url = track.baseUrl;
          if (wantTranslate) url = appendParam(url, 'tlang', userBase);
          try {
            const xml = await fetchText(url);
            const text = xmlTextToText(xml, includeTimestamps).trim();
            if (text) return text;
          } catch {}

          // 4) Try srv3 XML
          url = track.baseUrl;
          if (wantTranslate) url = appendParam(url, 'tlang', userBase);
          url = appendParam(url, 'fmt', 'srv3');
          try {
            const xml = await fetchText(url);
            const text = srv3XmlToText(xml, includeTimestamps).trim();
            if (text) return text;
          } catch {}
        }
      }

      // 3) Last-resort: capture the exact timedtext URL the player uses
      ensurePlayerCcOn();
      const captured = await tryNetworkCapture(includeTimestamps, 5000);
      if (captured) return captured;
    } catch (e) {
      console.warn('loadCaptionsText error:', e);
    }
    return null;
  }

  async function parseTranscriptFromUrl(url, includeTimestamps) {
    try {
      const u = new URL(url);
      const fmt = (u.searchParams.get('fmt') || '').toLowerCase();
      const raw = await fetchText(url);
      if (fmt === 'json3') {
        const t = json3ToText(raw, includeTimestamps).trim();
        if (t) return t;
      } else if (fmt === 'vtt') {
        const t = vttToText(raw, includeTimestamps).trim();
        if (t) return t;
      } else if (fmt === 'srv3') {
        const t = srv3XmlToText(raw, includeTimestamps).trim();
        if (t) return t;
      }
      // Heuristic fallback by sniffing content
      if (/^\s*\{/.test(raw)) {
        const t = json3ToText(raw, includeTimestamps).trim();
        if (t) return t;
      }
      if (/^\s*WEBVTT/.test(raw)) {
        const t = vttToText(raw, includeTimestamps).trim();
        if (t) return t;
      }
      // Try both XML parsers
      let t = xmlTextToText(raw, includeTimestamps).trim();
      if (t) return t;
      t = srv3XmlToText(raw, includeTimestamps).trim();
      if (t) return t;
    } catch (e) {
      // ignore
    }
    return null;
  }

  async function tryNetworkCapture(includeTimestamps, waitMs = 4000) {
    try {
      const startTime = performance.now();
      // Ensure hook installed (executed from background in MAIN world, not blocked by CSP)
      injectTimedtextHookOnce();

      // Also watch performance entries as a backup
      const checkEntries = () => {
        const entries = performance.getEntriesByType('resource');
        for (const e of entries) {
          const name = e.name || '';
          if (name.includes('/api/timedtext')) capturedTimedtextUrls.add(name);
        }
      };
      checkEntries();

      let obs;
      try {
        obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            const name = e.name || '';
            if (name.includes('/api/timedtext')) capturedTimedtextUrls.add(name);
          }
        });
        obs.observe({ type: 'resource', buffered: true });
      } catch {}

      // Wait until a timedtext url appears or timeout
      const initialCount = capturedTimedtextUrls.size;
      while ((performance.now() - startTime) < waitMs) {
        if (capturedTimedtextUrls.size > initialCount) break;
        checkEntries();
        await new Promise(r => setTimeout(r, 200));
      }
      try { obs && obs.disconnect(); } catch {}

      if (capturedTimedtextUrls.size === 0) return null;
      const urls = Array.from(capturedTimedtextUrls.values());
      // Prefer JSON3 first
      urls.sort((a, b) => (b.includes('json3')?1:0) - (a.includes('json3')?1:0));
      for (const url of urls) {
        const text = await parseTranscriptFromUrl(url, includeTimestamps);
        if (text) return text;
      }
    } catch (e) {
      console.warn('tryNetworkCapture error:', e);
    }
    return null;
  }

  // Inject a page-context hook once to capture timedtext network calls reliably
  let _hookInjected = false;
  function injectTimedtextHookOnce() {
    if (_hookInjected) return;
    _hookInjected = true;
    try { chrome.runtime.sendMessage({ action: 'injectTimedtextHook' }); } catch {}
  }

  // Removed external site fallback; we capture timedtext directly instead

  // ===== Extra fallback: query YouTube timedtext list API directly =====
  function getCurrentVideoId() {
    try {
      const u = new URL(location.href);
      // Only watch pages are matched by manifest, so prefer "v" param
      const v = u.searchParams.get('v');
      if (v) return v;
      // Fallbacks for robustness
      const m = location.href.match(/[?&#]v=([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    } catch {}
    return null;
  }

  async function getCaptionTracksViaApi(videoId) {
    try {
      // Keep domain on youtube.com to fit current host_permissions
      const listUrl = `https://www.youtube.com/api/timedtext?type=list&hl=en&v=${encodeURIComponent(videoId)}`;
      const res = await fetch(listUrl, { credentials: 'include' });
      if (!res.ok) return null;
      const xml = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const nodes = Array.from(doc.getElementsByTagName('track'));
      if (!nodes.length) return null;

      // Normalize to the same shape used by chooseBestCaptionTrack()
      const tracks = nodes.map(node => {
        const lang = node.getAttribute('lang_code') || node.getAttribute('lang') || '';
        const name = node.getAttribute('name') || '';
        const kind = (node.getAttribute('kind') || '').toLowerCase(); // 'asr' for auto
        const isAsr = kind === 'asr';
        const translatable = (node.getAttribute('translate') || '').toLowerCase() === 'true';
        const base = new URL('https://www.youtube.com/api/timedtext');
        base.searchParams.set('v', videoId);
        base.searchParams.set('lang', lang);
        if (isAsr) base.searchParams.set('kind', 'asr');
        if (name) base.searchParams.set('name', name);
        // Do not set fmt here; buildVttUrl() will append 'fmt=vtt'
        return {
          languageCode: lang,
          kind: isAsr ? 'asr' : undefined,
          name: name ? { simpleText: name } : undefined,
          baseUrl: base.toString(),
          isTranslatable: translatable
        };
      });
      return tracks;
    } catch (e) {
      console.warn('getCaptionTracksViaApi error:', e);
      return null;
    }
  }

  async function fetchText(url) {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  }

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
      backgroundColor: '#000',        // Changed from 'transparent'
      fontSize:        '11.5px',        // Added for better readability
      borderRadius:    '2px'          // Optional: matches button styling
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
  const direct = document.querySelector('button[aria-label="Show transcript"]');
  if (direct) return direct;
  // Fallback: menu item labeled "Show transcript"
  const labelNode = Array.from(document.querySelectorAll('yt-formatted-string'))
    .find(el => /\bshow transcript\b/i.test(el.textContent || ''));
  if (labelNode) {
    return labelNode.closest('tp-yt-paper-item, ytd-menu-service-item-renderer, button') || labelNode;
  }
  return null;
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
  let startMessage, includeTimestamps, showMessage, autoCopy,
      autoRedirectToTarget, autoPasteInTarget, autoSendInTarget,
      targetService;
  if (!chrome?.storage?.sync) {
    console.warn('Chrome storage not available, using defaults');
    startMessage = 'Please summarize this video transcript in 6-10 bullet points with a paragraph at the end answering the video title and main takeaways.';
    includeTimestamps = false;
    showMessage = true;
    autoCopy = false;
    autoRedirectToTarget = false;
    autoPasteInTarget = false;
    autoSendInTarget = false;
    targetService = 'chatgpt';
  } else {
    const settings = await chrome.storage.sync.get({
      startMessage: 'Please summarize this video transcript in 6-10 bullet points with a paragraph at the end answering the video title and main takeaways.',
      includeTimestamps: false,
      showMessage: true,
      autoCopy: false,
      // New generic keys
      autoRedirectToTarget: undefined,
      autoPasteInTarget: undefined,
      autoSendInTarget: undefined,
      targetService: 'chatgpt',
      // Legacy keys for fallback
      autoRedirectToChatGPT: false,
      autoPasteInChatGPT: false,
      autoSendInChatGPT: false
    });
    startMessage = settings.startMessage;
    includeTimestamps = settings.includeTimestamps;
    showMessage = settings.showMessage;
    autoCopy = settings.autoCopy;
    targetService = settings.targetService || 'chatgpt';
    autoRedirectToTarget = (typeof settings.autoRedirectToTarget === 'boolean') ? settings.autoRedirectToTarget : !!settings.autoRedirectToChatGPT;
    autoPasteInTarget = (typeof settings.autoPasteInTarget === 'boolean') ? settings.autoPasteInTarget : !!settings.autoPasteInChatGPT;
    autoSendInTarget = (typeof settings.autoSendInTarget === 'boolean') ? settings.autoSendInTarget : !!settings.autoSendInChatGPT;
  }

  // Step 1: try transcript UI first; fall back to captions if needed
  if (bufferedTranscript === null) {
    // Primary: transcript UI scraping
    setMessage('Loading transcript…', showMessage);
    {
      let panel = document.querySelector('#segments-container');
      if (!panel) {
        setMessage('Opening transcript…', showMessage);
        openDescriptionPanel();
        await new Promise(resolve => setTimeout(resolve, 300));
        const transcriptBtn = findTranscriptButton();
        if (transcriptBtn) {
          transcriptBtn.click();
          const loaded = await waitForTranscriptLoad();
          if (!loaded) {
            panel = null;
          }
          if (!panel) panel = document.querySelector('#segments-container');
        } else {
          panel = null;
        }
      }
      if (panel) {
        const segments = Array.from(panel.querySelectorAll('ytd-transcript-segment-renderer'));
        if (segments.length) {
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
        }
      }
    }

    // Fallback: CC/subtitles
    if (bufferedTranscript === null) {
      setMessage('Trying captions…', showMessage);
      ensurePlayerCcOn();
      await new Promise(r => setTimeout(r, 250));
      const ccText = await loadCaptionsText(includeTimestamps);
      if (ccText) {
        bufferedTranscript = ccText;
      } else {
        setMessage('No captions or transcript found.', showMessage);
        return;
      }
    }
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

    // NEW: Send to selected target if redirect is enabled
    if (autoRedirectToTarget) {
      const serviceName = targetService === 'claude' ? 'Claude' : (targetService === 'gemini' ? 'Gemini' : 'ChatGPT');
      setMessage(`Opening ${serviceName}...`, showMessage);
      chrome.runtime.sendMessage({
        action: 'sendToTarget',
        payload: payload,
        autoPaste: autoPasteInTarget,
        autoSend: autoSendInTarget,
        targetService
      });
    }

    // Download feature reverted
  } catch (e) {
    console.error('Clipboard error:', e);
    setMessage('Failed to copy transcript.', showMessage);
  }
  bufferedTranscript = null;
}

  // Initialize the button and re-inject on SPA nav
  createButton();
  new MutationObserver(createButton).observe(document.body, { childList: true, subtree: true });
  // Proactively install network hook to capture timedtext requests
  try { injectTimedtextHookOnce(); } catch {}
})();
