document.addEventListener('DOMContentLoaded', async () => {
    const addButton = document.getElementById('newConfig');
    const saveButton = document.getElementById('saveConfig');
    const clearButton = document.getElementById('clearConfig');
    const statusMessage = document.getElementById('statusMessage');

    // 加载保存的配置
    try {
        const savedConfig = await chrome.storage.local.get(['configs']) || { configs: [] };
        const groups = document.querySelector('.groups');
        savedConfig.configs.forEach(config => {
            const newGroup = document.getElementById('GROUP_TEMPLATE').content.cloneNode(true);
            newGroup.querySelector('label').textContent = config.label;
            newGroup.querySelector('input[name="target_selector"]').value = config.target_selector;
            newGroup.querySelector('input[name="iframe_selector"]').value = config.iframe_selector;
            newGroup.querySelector('textarea[name="content"]').value = config.content;
            groups.appendChild(newGroup);
        })
    } catch (error) {
        showMessage('加载配置失败: ' + error.message, 'error');
    }

    // 新增配置
    addButton.addEventListener('click', () => {
        const labelName = prompt("请输入配置目标名称：");
        if (!labelName) return;
        const newGroup = document.getElementById('GROUP_TEMPLATE').content.cloneNode(true);
        newGroup.querySelector('label').textContent = labelName;
        newGroup.querySelector('input[name="target_selector"]').value = '';
        newGroup.querySelector('input[name="iframe_selector"]').value = '';
        newGroup.querySelector('textarea[name="content"]').value = '';
        document.querySelector(".groups").appendChild(newGroup);
    })

    // 保存配置按钮点击事件
    saveButton.addEventListener('click', async () => {
        // 获取所有配置组
        const configGroups = document.querySelectorAll('.config-group');
        const configs = [];

        configGroups.forEach(group => {
            const label = group.querySelector('label').textContent;
            const target_selector = group.querySelector('input[name="target_selector"]').value.trim();
            const iframe_selector = group.querySelector('input[name="iframe_selector"]').value.trim();
            const content = group.querySelector('textarea[name="content"]').value.trim();

            configs.push({
                label,
                target_selector,
                iframe_selector,
                content
            });
        });

        try {
            await chrome.storage.local.set({
                configs
            });
            showMessage('配置已成功保存', 'success');
        } catch (error) {
            showMessage('保存配置失败: ' + error.message, 'error');
        }
    });

    // 清除配置按钮点击事件
    clearButton.addEventListener('click', async () => {
        try {
            await chrome.storage.local.set({
                configs: []
            });
            showMessage('配置已成功清除', 'success');
        } catch (error) {
            showMessage('清除配置失败: ' + error.message, 'error');
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