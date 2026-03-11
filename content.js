// Content Script for LeetCode Solution Post Generator

(function() {
  'use strict';

  let problemData = null;
  let generatedContent = '';
  let solutionCount = 0;

  init();

  function init() {
    setTimeout(() => {
      injectGenerateButton();
      setupMessageListener();
    }, 1000);
  }

  function injectGenerateButton() {
    if (document.getElementById('lsp-generate-btn')) return;

    const button = document.createElement('button');
    button.id = 'lsp-generate-btn';
    button.className = 'lsp-generate-button lsp-floating';
    button.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      Gen Post
    `;
    button.onclick = openSolutionSelector;
    document.body.appendChild(button);
  }

  function scrapeProblemData() {
    const data = { title: '', description: '', url: window.location.href };

    const titleSelectors = [
      '[data-cy="question-title"]',
      '.text-title-large',
      '.mr-2.text-lg',
      'a[href*="/problems/"] span',
      'div[class*="title"]'
    ];

    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 2) {
        data.title = el.textContent.trim();
        break;
      }
    }

    if (!data.title) {
      const match = window.location.href.match(/problems\/([^\/]+)/);
      if (match) {
        data.title = match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }

    const descSelectors = ['[data-cy="question-content"]', '.elfjS', 'div[class*="description"]'];
    for (const selector of descSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        data.description = el.textContent.trim().substring(0, 2000);
        break;
      }
    }

    return data;
  }

  function openSolutionSelector() {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      alert('Extension was updated. Please refresh this page (F5) and try again.');
      return;
    }

    problemData = scrapeProblemData();
    solutionCount = 0; // Reset counter
    
    const existingModal = document.getElementById('lsp-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'lsp-modal';
    modal.className = 'lsp-modal-overlay';
    modal.innerHTML = `
      <div class="lsp-modal">
        <div class="lsp-modal-header">
          <h2>Generate LeetCode Post</h2>
          <button class="lsp-close-btn" id="lsp-close">&times;</button>
        </div>
        <div class="lsp-modal-body">
          <div class="lsp-section">
            <h3>Problem</h3>
            <input type="text" id="lsp-problem-title" class="lsp-title-input" value="${problemData.title || ''}" placeholder="Problem title">
          </div>
          
          <div class="lsp-section">
            <h3>Your Solutions</h3>
            <p class="lsp-hint">Add your code. AI will generate Python, JavaScript, Java, C++ versions.</p>
            <div id="lsp-solutions-container"></div>
            <button class="lsp-add-btn" id="lsp-add-solution">+ Add Another Approach</button>
          </div>
        </div>
        <div class="lsp-modal-footer">
          <button class="lsp-btn lsp-btn-secondary" id="lsp-cancel">Cancel</button>
          <button class="lsp-btn lsp-btn-primary" id="lsp-generate">Generate Post</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    addSolutionInput();

    document.getElementById('lsp-close').onclick = () => modal.remove();
    document.getElementById('lsp-cancel').onclick = () => modal.remove();
    document.getElementById('lsp-add-solution').onclick = addSolutionInput;
    document.getElementById('lsp-generate').onclick = handleGenerate;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }

  function addSolutionInput() {
    solutionCount++;
    const container = document.getElementById('lsp-solutions-container');
    
    const div = document.createElement('div');
    div.className = 'lsp-solution-input';
    div.innerHTML = `
      <div class="lsp-solution-header">
        <span>Approach ${solutionCount}</span>
        <select class="lsp-lang-select">
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="javascript">JavaScript</option>
        </select>
        ${solutionCount > 1 ? '<button class="lsp-remove-btn" onclick="this.closest(\'.lsp-solution-input\').remove()">Remove</button>' : ''}
      </div>
      <input type="text" class="lsp-approach-input" placeholder="Approach name (e.g., HashMap, Two Pointers)">
      <textarea class="lsp-code-textarea" placeholder="Paste your solution code here..."></textarea>
    `;
    container.appendChild(div);
  }

  async function handleGenerate() {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      alert('Extension was updated. Please refresh this page (F5) and try again.');
      return;
    }

    const btn = document.getElementById('lsp-generate');
    btn.disabled = true;
    btn.textContent = 'Generating...';

    try {
      const solutions = [];
      document.querySelectorAll('.lsp-solution-input').forEach((div) => {
        const code = div.querySelector('textarea').value.trim();
        const language = div.querySelector('select').value;
        const approach = div.querySelector('.lsp-approach-input').value.trim();
        if (code) solutions.push({ code, language, approach });
      });

      if (solutions.length === 0) {
        throw new Error('Please add at least one solution');
      }

      const title = document.getElementById('lsp-problem-title').value || problemData.title;

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'generatePost',
          data: {
            problemTitle: title,
            problemDescription: problemData.description,
            solutions,
            targetLanguages: ['English']
          }
        }, (resp) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!resp) {
            reject(new Error('No response from background script'));
          } else if (!resp.success) {
            reject(new Error(resp.error || 'Generation failed'));
          } else {
            resolve(resp);
          }
        });
      });

      generatedContent = response.data;
      document.getElementById('lsp-modal')?.remove();
      showResultModal(generatedContent);

    } catch (error) {
      alert('Error: ' + error.message);
      btn.disabled = false;
      btn.textContent = 'Generate Post';
    }
  }

  function showResultModal(content) {
    const existing = document.getElementById('lsp-result-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'lsp-result-modal';
    modal.className = 'lsp-modal-overlay';
    modal.innerHTML = `
      <div class="lsp-modal lsp-result-modal">
        <div class="lsp-modal-header">
          <h2>Generated Post</h2>
          <button class="lsp-close-btn" id="lsp-result-close">&times;</button>
        </div>
        <div class="lsp-modal-body">
          <div class="lsp-result-actions">
            <button class="lsp-btn lsp-btn-primary" id="lsp-copy-btn">Copy to Clipboard</button>
          </div>
          <p class="lsp-hint">Edit below, then copy and paste into LeetCode's post editor:</p>
          <textarea id="lsp-result-content" class="lsp-result-textarea"></textarea>
        </div>
        <div class="lsp-modal-footer">
          <button class="lsp-btn lsp-btn-secondary" id="lsp-result-close-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('lsp-result-content').value = content;

    document.getElementById('lsp-result-close').onclick = () => modal.remove();
    document.getElementById('lsp-result-close-btn').onclick = () => modal.remove();
    
    document.getElementById('lsp-copy-btn').onclick = () => {
      const textarea = document.getElementById('lsp-result-content');
      textarea.select();
      textarea.setSelectionRange(0, 99999);
      
      try {
        document.execCommand('copy');
        const btn = document.getElementById('lsp-copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy to Clipboard'; }, 2000);
        showNotification('Copied! Now paste into LeetCode editor with Ctrl+V', 'success');
      } catch (e) {
        showNotification('Please select all and copy manually (Ctrl+A, Ctrl+C)', 'info');
      }
    };

    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }

  function showNotification(message, type) {
    const existing = document.getElementById('lsp-notification');
    if (existing) existing.remove();

    const n = document.createElement('div');
    n.id = 'lsp-notification';
    n.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 14px 28px;
      background: ${type === 'success' ? '#10b981' : '#6366f1'};
      color: white;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      z-index: 100001;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    `;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => { if (n.parentNode) n.remove(); }, 4000);
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getProblemData') {
        sendResponse(scrapeProblemData());
        return false;
      }
      if (request.action === 'openSelector') {
        openSolutionSelector();
        sendResponse({ success: true });
        return false;
      }
      return false;
    });
  }

})();
