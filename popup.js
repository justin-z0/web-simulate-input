var WSI_CONFIG;

(async () => {
    // 加载配置
    WSI_CONFIG = await chrome.storage.local.get(['configs']) || { configs: [] };

    // 构造发送按钮列表
    const sendList = document.getElementById('sendList');
    const sendTemplate = document.getElementById('SEND_TEMPLATE');
    WSI_CONFIG.configs.forEach((config) => {
        const sendItem = sendTemplate.content.cloneNode(true);
        sendItem.querySelector('label').textContent = config.label;
        sendItem.querySelector('button').textContent = '发送';
        sendItem.querySelector('button').addEventListener('click', async () => {
            let inputText = document.getElementById('textInput').value.trim();
            inputText = inputText || config.content;    // 如果输入框为空，使用配置内容
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: autoInput,
                    args: [inputText, config]
                })
            } catch (e) {
                console.error("发送失败: " + e.message);
            }
        })
        sendList.appendChild(sendItem);
    })
})();

/**
 * 通过模拟按键事件向目标元素发送文本
 * @param {HTMLElement} targetElement - 目标元素
 * @param {string} inputText - 要输入的文本
 */
function sendByOnceKey(targetElement, inputText) {
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
}

function autoInput(inputText, config) {
    let targetElement;
    if (config.iframe_selector) {
        let iframe_doc = document.querySelector(config.iframe_selector).contentDocument;
        if (!iframe_doc) {
            console.error("未找到iframe元素");
            return;
        }
        targetElement = iframe_doc.querySelector(config.target_selector);
    } else {
        targetElement = document.querySelector(config.target_selector);
    }

    if (!targetElement) {
        console.error("未找到可输入元素");
        return;
    }

    targetElement.textContent = inputText;
}