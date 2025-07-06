document.getElementById('sendButton').addEventListener('click', async () => {
    const text = document.getElementById('textInput').value.trim();
    if (!text) return;

    try {
        // 获取当前活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const savedConfig = await chrome.storage.local.get(['elementSelector', 'isFrame']);

        // 注入脚本到页面
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (inputText, config) => {
                let elementSelector = config.elementSelector || '';
                let isFrame = config.isFrame || false;
                let targetElement;
                
                if (!elementSelector) {
                    elementSelector = '#cmdline_frame > iframe';
                    isFrame = true;
                }

                targetElement = document.querySelector(elementSelector);
                if (isFrame) {
                    targetElement = targetElement.contentDocument;
                }
                
                if (!targetElement) {
                    alert('未找到可输入元素');
                    return;
                }

                // 为每个字符创建并分发按键事件
                for (const char of inputText) {
                    // 创建keypress事件
                    const keypressEvent = new KeyboardEvent('keypress', {
                        key: char,
                        code: `Key${char.toUpperCase()}`,
                        charCode: char.charCodeAt(0),
                        keyCode: char.charCodeAt(0),
                        which: char.charCodeAt(0),
                        bubbles: true,
                        cancelable: true
                    });

                    // 分发事件
                    targetElement.dispatchEvent(keypressEvent);
                }
            },
            args: [text, savedConfig]
        });
    } catch (error) {
        console.error('发送事件失败:', error);
        alert('发送失败，请重试');
    }
});