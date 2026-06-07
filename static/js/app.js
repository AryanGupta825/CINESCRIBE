/* ── CineScribe App JS ─────────────────────────────────────── */

// DOM refs
const form          = document.getElementById('inputForm');
const sourceInput   = document.getElementById('sourceInput');
const langSelect    = document.getElementById('languageSelect');
const analyseBtn    = document.getElementById('analyseBtn');
const heroSection   = document.getElementById('heroSection');
const resultsSection = document.getElementById('resultsSection');
const pipelinePanel  = document.getElementById('pipelinePanel');
const toast          = document.getElementById('toast');

// Result fields
const sessionTitle    = document.getElementById('sessionTitle');
const summaryContent  = document.getElementById('summaryContent');
const transcriptContent = document.getElementById('transcriptContent');
const transcriptToggle  = document.getElementById('transcriptToggle');
const actionContent   = document.getElementById('actionContent');
const decisionsContent = document.getElementById('decisionsContent');
const questionsContent = document.getElementById('questionsContent');

// Chat
const chatMessages   = document.getElementById('chatMessages');
const chatInput      = document.getElementById('chatInput');
const sendBtn        = document.getElementById('sendBtn');
const clearChatBtn   = document.getElementById('clearChatBtn');
const chatActionsBar = document.getElementById('chatActionsBar');

// State
let currentJobId  = null;
let pollInterval  = null;

/* ── Utils ────────────────────────────────────────────────── */
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function setStep(key, state) {
  const dot  = document.querySelector(`.step-dot[data-step="${key}"]`);
  const item = document.querySelector(`.step-item[data-step="${key}"]`);
  if (!dot || !item) return;
  dot.className  = `step-dot ${state}`;
  item.className = `step-item ${state === 'active' ? 'active-step' : state === 'done' ? 'done-step' : ''}`;
}

function updatePipeline(steps) {
  Object.entries(steps).forEach(([k, v]) => setStep(k, v));
}

function resetSteps() {
  ['audio','transcript','title','summary','extract','rag'].forEach(k => setStep(k, 'pending'));
}

/* ── Transcript toggle ────────────────────────────────────── */
transcriptToggle.addEventListener('click', () => {
  const hidden = transcriptContent.classList.toggle('hidden');
  transcriptToggle.textContent = hidden ? 'Show' : 'Hide';
});

/* ── Form submit ──────────────────────────────────────────── */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const source = sourceInput.value.trim();
  if (!source) { showToast('Please enter a YouTube URL or file path.', 'error'); return; }

  // Reset UI
  currentJobId = null;
  clearInterval(pollInterval);
  resetSteps();
  pipelinePanel.classList.remove('hidden');
  heroSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  analyseBtn.disabled = true;
  analyseBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    Analysing…`;

  const style = document.createElement('style');
  style.id = 'spin-style';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  if (!document.getElementById('spin-style')) document.head.appendChild(style);

  try {
    const res = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, language: langSelect.value }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Server error', 'error'); resetAnalyseBtn(); return; }
    currentJobId = data.job_id;
    startPolling();
  } catch (err) {
    showToast('Network error. Is the server running?', 'error');
    resetAnalyseBtn();
  }
});

function resetAnalyseBtn() {
  analyseBtn.disabled = false;
  analyseBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    Analyse`;
}

/* ── Polling ──────────────────────────────────────────────── */
function startPolling() {
  pollInterval = setInterval(poll, 2000);
  poll(); // immediate first hit
}

async function poll() {
  if (!currentJobId) return;
  try {
    const res = await fetch(`/api/status/${currentJobId}`);
    const data = await res.json();
    if (!res.ok) return;

    updatePipeline(data.steps || {});

    if (data.status === 'done') {
      clearInterval(pollInterval);
      renderResults(data.result);
      resetAnalyseBtn();
      showToast('Analysis complete!', 'success');
    } else if (data.status === 'error') {
      clearInterval(pollInterval);
      showToast(`Error: ${data.error}`, 'error');
      resetAnalyseBtn();
    }
  } catch {}
}

/* ── Render results ───────────────────────────────────────── */
function renderResults(r) {
  sessionTitle.textContent     = r.title      || '—';
  summaryContent.textContent   = r.summary    || '—';
  transcriptContent.textContent = r.transcript || '—';
  actionContent.textContent    = r.action_items   || '—';
  decisionsContent.textContent = r.key_decisions  || '—';
  questionsContent.textContent = r.open_questions || '—';

  // Reset chat
  chatMessages.innerHTML = `
    <div class="chat-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <p>Ask anything about your meeting transcript</p>
    </div>`;
  chatActionsBar.style.display = 'none';

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Chat ─────────────────────────────────────────────────── */
function appendMessage(role, text) {
  // Remove empty-state placeholder
  const empty = chatMessages.querySelector('.chat-empty');
  if (empty) empty.remove();

  const wrap   = document.createElement('div');
  wrap.className = `chat-msg msg-${role}`;

  const label  = document.createElement('span');
  label.className = `chat-role ${role}-role`;
  label.textContent = role === 'user' ? 'You' : 'Assistant';

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}-bubble`;
  bubble.textContent = text;

  wrap.appendChild(label);
  wrap.appendChild(bubble);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChat() {
  const q = chatInput.value.trim();
  if (!q || !currentJobId) return;

  chatInput.value = '';
  sendBtn.disabled = true;
  appendMessage('user', q);

  // Typing indicator
  const typing = document.createElement('div');
  typing.className = 'chat-msg msg-bot';
  typing.innerHTML = `<span class="chat-role bot-role">Assistant</span><div class="chat-bubble bot-bubble" style="color:var(--text-muted);font-style:italic">Thinking…</div>`;
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: currentJobId, question: q }),
    });
    const data = await res.json();
    typing.remove();
    if (!res.ok) { showToast(data.error || 'Chat error', 'error'); }
    else {
      appendMessage('bot', data.answer);
      chatActionsBar.style.display = 'block';
    }
  } catch {
    typing.remove();
    showToast('Network error during chat.', 'error');
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

sendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });

clearChatBtn.addEventListener('click', () => {
  chatMessages.innerHTML = `
    <div class="chat-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <p>Ask anything about your meeting transcript</p>
    </div>`;
  chatActionsBar.style.display = 'none';
});
