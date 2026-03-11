// Options Script for LeetCode Solution Post Generator

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('api-key');
  const toggleVisibility = document.getElementById('toggle-visibility');
  const modelSelect = document.getElementById('model-select');
  const saveApiBtn = document.getElementById('save-api');
  const saveDefaultsBtn = document.getElementById('save-defaults');
  const statusAlert = document.getElementById('status-alert');
  const autoInject = document.getElementById('auto-inject');
  const includeCode = document.getElementById('include-code');

  loadSettings();

  toggleVisibility.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleVisibility.textContent = 'Hide';
    } else {
      apiKeyInput.type = 'password';
      toggleVisibility.textContent = 'Show';
    }
  });

  saveApiBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;

    if (!apiKey) {
      showAlert('Please enter an API key', 'error');
      return;
    }

    if (!apiKey.startsWith('AIza')) {
      showAlert('Invalid API key format. Gemini keys start with "AIza"', 'error');
      return;
    }

    saveApiBtn.disabled = true;
    saveApiBtn.textContent = 'Testing...';

    try {
      const isValid = await testApiKey(apiKey);
      
      if (isValid) {
        await chrome.storage.sync.set({
          geminiApiKey: apiKey,
          geminiModel: model
        });
        showAlert('API settings saved successfully!', 'success');
      } else {
        showAlert('Invalid API key. Please check and try again.', 'error');
      }
    } catch (error) {
      showAlert('Error testing API key: ' + error.message, 'error');
    }

    saveApiBtn.disabled = false;
    saveApiBtn.textContent = 'Save API Settings';
  });

  saveDefaultsBtn.addEventListener('click', async () => {
    const defaultLanguages = [];
    document.querySelectorAll('input[name="default-lang"]:checked').forEach(cb => {
      defaultLanguages.push(cb.value);
    });

    await chrome.storage.sync.set({
      defaultLanguages,
      autoInject: autoInject.checked,
      includeCode: includeCode.checked
    });

    showAlert('Default settings saved!', 'success');
  });

  async function loadSettings() {
    const result = await chrome.storage.sync.get([
      'geminiApiKey',
      'geminiModel',
      'defaultLanguages',
      'autoInject',
      'includeCode'
    ]);

    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }

    if (result.geminiModel) {
      modelSelect.value = result.geminiModel;
    }

    if (result.defaultLanguages) {
      document.querySelectorAll('input[name="default-lang"]').forEach(cb => {
        cb.checked = result.defaultLanguages.includes(cb.value);
      });
    }

    if (result.autoInject !== undefined) {
      autoInject.checked = result.autoInject;
    }

    if (result.includeCode !== undefined) {
      includeCode.checked = result.includeCode;
    }
  }

  async function testApiKey(apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      return response.ok;
    } catch (error) {
      console.error('API test error:', error);
      return false;
    }
  }

  function showAlert(message, type) {
    statusAlert.textContent = message;
    statusAlert.className = `alert alert-${type}`;
    statusAlert.classList.remove('hidden');

    setTimeout(() => {
      statusAlert.classList.add('hidden');
    }, 5000);
  }
});
