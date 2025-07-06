document.addEventListener('DOMContentLoaded', async () => {
    const selectorInput = document.getElementById('selectorInput');
    const saveButton = document.getElementById('saveConfig');
    const statusMessage = document.getElementById('statusMessage');
    const selectorIframe = document.getElementById('selectorIframe');

    // 加载保存的配置
    try {
        const savedConfig = await chrome.storage.local.get(['elementSelector', 'isFrame']);
        if (savedConfig.elementSelector) {
            selectorInput.value = savedConfig.elementSelector;
        }
        if (savedConfig.isFrame) {
            selectorIframe.checked = savedConfig.isFrame;
        }
    } catch (error) {
        showMessage('加载配置失败: ' + error.message, 'error');
    }

    // 保存配置按钮点击事件
    saveButton.addEventListener('click', async () => {
        const selector = selectorInput.value.trim();
        if (!selector) {
            showMessage('请输入有效的选择器', 'error');
            return;
        }

        try {
            await chrome.storage.local.set({ 
                elementSelector: selector,
                isFrame: document.getElementById('selectorIframe').checked
            });
            showMessage('配置已成功保存', 'success');
        } catch (error) {
            showMessage('保存配置失败: ' + error.message, 'error');
        }
    });

    // 显示状态消息
    function showMessage(text, type) {
        statusMessage.textContent = text;
        statusMessage.className = 'status-message ' + type;
        statusMessage.style.display = 'block';

        // 3秒后自动隐藏消息
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 2000);
    }
});