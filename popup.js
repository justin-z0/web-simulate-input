var WSI_CONFIG;

// Chrome 禁止扩展向浏览器内部页面注入脚本。这些协议下一律无法工作，
// 访问 chrome://extensions 时会报 "Cannot access a chrome:// URL"。
const RESTRICTED_SCHEME_RE = /^(chrome|chrome-untrusted|edge|brave|opera|vivaldi|about|devtools|view-source|chrome-extension|moz-extension|extension|edge-extension|safari-extension):/i;
// 网上应用店页面即使是 https 也被禁止注入
const RESTRICTED_HOST_RE = /^(chrome\.google\.com\/webstore|chromewebstore\.google\.com|microsoftedge\.microsoft\.com\/addons)/i;

/**
 * 判断该 URL 是否属于扩展无法注入的页面。
 * 拿不到 url（没有 tabs 权限时可能为 undefined）时返回 false，交给实际注入去报错。
 * @param {string} [url]
 * @returns {boolean}
 */
function isRestrictedUrl(url) {
    if (!url) return false;
    if (RESTRICTED_SCHEME_RE.test(url)) return true;
    return RESTRICTED_HOST_RE.test(url.replace(/^https?:\/\//i, ''));
}

(async () => {
    const sendList = document.getElementById('sendList');
    const sendTemplate = document.getElementById('SEND_TEMPLATE');
    const textInput = document.getElementById('textInput');
    const notice = document.getElementById('notice');

    function showNotice(text) {
        notice.textContent = text;
        notice.style.display = 'block';
    }

    // 加载配置：get 传入默认值对象，这样 key 不存在时也会得到 { configs: [] }。
    // 注意不能用 `await get(['configs']) || { configs: [] }`：key 不存在时 get 返回的是
    // 空对象 {}（truthy），兜底不会生效，configs 仍然是 undefined。
    const stored = await chrome.storage.local.get({ configs: [] });
    WSI_CONFIG = { configs: Array.isArray(stored.configs) ? stored.configs : [] };

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 注入公共函数到页面。下面的 checkTargetExists 依赖它定义的 window.getTarget，
    // 所以必须 await。注入失败通常意味着当前页面不允许扩展运行（chrome:// 等）。
    let injectError = null;
    if (!tab || tab.id === undefined) {
        injectError = new Error('没有找到可用的活动标签页');
    } else if (isRestrictedUrl(tab.url)) {
        injectError = new Error('浏览器内部页面（' + tab.url + '）不允许扩展注入脚本');
    } else {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: injectFunctions
            });
        } catch (e) {
            injectError = e;
        }
    }

    if (injectError) {
        // 这是预期内的限制，不是缺陷：用面板提示代替控制台报错
        showNotice('当前页面无法使用：' + injectError.message +
            '\n请切换到普通网页（http/https）后重新打开本面板。');
    } else if (WSI_CONFIG.configs.length === 0) {
        showNotice('还没有任何配置。请在扩展的选项页中添加目标选择器和要发送的内容。');
    }

    // 构造发送按钮列表
    // 用 for...of 而不是 forEach，保证 await 按顺序执行，按钮顺序与配置顺序一致
    for (const config of WSI_CONFIG.configs) {
        const sendItem = sendTemplate.content.cloneNode(true);
        sendItem.querySelector('label').textContent = config.label;
        sendItem.querySelector('button').textContent = '发送';
        sendItem.querySelector('button').addEventListener('click', async () => {
            let inputText = textInput.value.trim();
            inputText = inputText || config.content;    // 如果输入框为空，使用配置内容
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: sendText,
                    args: [inputText, config]
                })
            } catch (e) {
                console.error("发送失败: " + e.message);
            }
        })

        // 如果当前页面没有所配置的元素，则禁用发送按钮
        if (injectError) {
            sendItem.querySelector("li").classList.add("disabled");
        } else {
            try {
                // 解构时给出兜底，避免 executeScript 返回空数组时抛出 "not iterable"
                const [{ result } = {}] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: checkTargetExists,
                    args: [config]
                });
                if (!result) {
                    sendItem.querySelector("li").classList.add("disabled");
                }
            } catch (e) {
                console.error("检测目标元素失败: " + e.message);
                sendItem.querySelector("li").classList.add("disabled");
            }
        }

        sendList.appendChild(sendItem);
    }

})().catch(e => {
    console.error("popup 初始化失败: " + e.message);
    const notice = document.getElementById('notice');
    if (notice) {
        notice.textContent = '面板初始化失败：' + e.message;
        notice.style.display = 'block';
    }
});

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

/**
 * 自动输入内容到指定元素
 * @param {String} inputText - 需要填入页面的内容
 * @param {Object} config - 配置信息
 */
function sendText(inputText, config) {
    let targetElement = getTarget(config);
    if (!targetElement) {
        console.error("未找到可输入元素");
        return;
    }
    targetElement.value = inputText;
}

function checkTargetExists(config) {
    let targetElement = getTarget(config);
    return !!targetElement;
}

///////////////////////////////////////////////////////////////////////
// 下面定义的内部函数将被注入到tab页面中
///////////////////////////////////////////////////////////////////////

function injectFunctions() {
    window.getTarget = function(config) {
        if (config.iframe_selector) {
            // 先判空，否则选择器不匹配时会在页面里抛
            // "Cannot read properties of null (reading 'contentDocument')"
            const iframe = document.querySelector(config.iframe_selector);
            if (!iframe) {
                console.error("未找到 iframe 元素: " + config.iframe_selector);
                return null;
            }
            const iframe_doc = iframe.contentDocument;
            if (!iframe_doc) {
                console.error("无法访问 iframe 内容（可能跨域）: " + config.iframe_selector);
                return null;
            }
            return iframe_doc.querySelector(config.target_selector);
        }

        return document.querySelector(config.target_selector);
    }
}
