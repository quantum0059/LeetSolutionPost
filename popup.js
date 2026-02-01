// Popup Script for LeetCode Solution Post Generator

document.addEventListener('DOMContentLoaded', async () => {
  const statusMessage = document.getElementById('status-message');
  const openGenerator = document.getElementById('open-generator');
  const scrapeCode = document.getElementById('scrape-code');
  const apiIndicator = document.getElementById('api-indicator');
  const apiText = document.getElementById('api-text');
  const openOptions = document.getElementById('open-options');

  // Check API key status
  checkApiStatus();

  // Check if we're on a LeetCode problem page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab && tab.url && tab.url.includes('leetcode.com/problems/')) {
    statusMessage.textContent = 'Ready to generate!';
    statusMessage.classList.add('success');
    openGenerator.disabled = false;
    scrapeCode.disabled = false;
  } else {
    statusMessage.textContent = 'Navigate to a LeetCode problem page to use this extension.';
    statusMessage.classList.add('warning');
  }

  // Open generator button
  openGenerator.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'openSelector' });
      window.close();
    } catch (error) {
      // Content script might not be loaded, inject it
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
      
      // Try again
      setTimeout(async () => {
        await chrome.tabs.sendMessage(tab.id, { action: 'openSelector' });
        window.close();
      }, 500);
    }
  });

  // Scrape code button
  scrapeCode.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getCodeFromEditor' });
      
      if (response && response.code) {
        await navigator.clipboard.writeText(response.code);
        scrapeCode.textContent = 'Copied!';
        setTimeout(() => {
          scrapeCode.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Grab Current Code
          `;
        }, 2000);
      } else {
        alert('No code found in editor');
      }
    } catch (error) {
      alert('Could not access editor. Make sure you are on a problem page.');
    }
  });

  // Open options
  openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Check API status
  async function checkApiStatus() {
    const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });
    
    if (response && response.apiKey) {
      apiIndicator.classList.add('connected');
      apiText.textContent = 'API Key Configured';
    } else {
      apiIndicator.classList.add('disconnected');
      apiText.textContent = 'API Key Not Set';
      apiText.innerHTML = '<a href="#" id="setup-api">Click to setup</a>';
      document.getElementById('setup-api')?.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });
    }
  }
});
