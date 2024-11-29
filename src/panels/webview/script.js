const vscode = acquireVsCodeApi();

// 初始化时恢复状态
let previousState = vscode.getState() || { results: null };
if (previousState.results) {
    displayResults(previousState.results);
}

console.log = (...args) => {
    vscode.postMessage({
        command: 'log',
        text: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')
    });
};

// 开始扫描
document.getElementById('startScan').addEventListener('click', () => {
    vscode.postMessage({ command: 'startScan' });
    document.getElementById('results').innerHTML = '<div class="loading">扫描中，请稍候...</div>';
});

// 接收消息
window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'scanComplete') {
        // 保存状态
        vscode.setState({ results: message.results });
        displayResults(message.results);
    }
});

// 显示结果
function displayResults(results) {
    // console.log(results);
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = formatFileContent(results);
}

// 添加标签页切换事件处理函数
function addTabEventListeners() {
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            // 移除所有活动状态
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.style.display = 'none';
                pane.classList.remove('active');
            });
            
            // 设置当前标签页为活动状态
            e.target.classList.add('active');
            const tabId = e.target.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            document.getElementById(tabId).style.display = 'block';
        });
    });
}

// 辅助函数：格式化文件大小
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
// 格式化文件内容
function formatFileContent(content) {
    try {
        const jsonContent = JSON.parse(content);
        // 创建标签页容器
        let html = `
            <div class="tabs">
                <button class="tab-button active" data-tab="eslint">ES规范检查</button>
                <button class="tab-button" data-tab="stylelint">样式规范检查</button>
                <button class="tab-button" data-tab="git">Git规范检查</button>
                <button class="tab-button" data-tab="config">工程规范检查</button>
                <button class="tab-button" data-tab="count">函数类型检查</button>
                <button class="tab-button" data-tab="redundancy">代码冗余检查</button>
            </div>
            <div class="tab-content">`;

        // 使用各个模块的格式化函数
        const formatters = {
            eslint: formatEslintInfo,
            stylelint: formatStylelintInfo,
            count: formatCountInfo,
            git: formatGitInfo,
            config: formatConfigInfo,
            redundancy: formatRedundancyInfo
        };

        // 生成各个标签页的内容
        Object.entries(formatters).forEach(([id, formatter], index) => {
            html += `
                <div class="tab-pane ${index === 0 ? 'active' : ''}" id="${id}">
                    ${formatter(jsonContent[`${id}Info`])}
                </div>`;
        });

        html += '</div>';

        // 添加标签页切换的事件处理
        setTimeout(addTabEventListeners, 0);

        return html;
    } catch (error) {
        console.log('解析JSON失败:', error.stack);
        return `<pre class="result-text">${content}</pre>`;
    }
}

// 格式化ESLint分析数据
function formatEslintInfo(eslintInfo) {
    if (!eslintInfo) return '<p>无分析数据</p>';

    // 先添加 toggle 函数到 window 对象
    if (!window.toggleEslintMessageList) {
        window.toggleEslintMessageList = function(header) {
            const fileItem = header.parentElement;
            const messageList = fileItem.querySelector('.eslint-file__messages');
            const toggleIcon = header.querySelector('.toggle-icon');
            
            if (messageList.style.display === 'none') {
                messageList.style.display = 'block';
                toggleIcon.textContent = '▼';
            } else {
                messageList.style.display = 'none';
                toggleIcon.textContent = '▶';
            }
        };

        // 初始化所有消息列表的显示状态
        setTimeout(() => {
            document.querySelectorAll('.eslint-file__messages').forEach(list => {
                list.style.display = 'none';
            });
        }, 0);
    }

    const summary = `
        <div class="summary-section">
            <div class="eslint-summary">
                <div class="eslint-stat">
                    <span class="stat-label">总文件数：</span>
                    <span class="stat-value">${eslintInfo.totalFilesCount}</span>
                </div>
                <div class="eslint-stat eslint-stat--error">
                    <span class="stat-label">错误数：</span>
                    <span class="stat-value">${eslintInfo.errorCount}</span>
                </div>
                <div class="eslint-stat eslint-stat--warning">
                    <span class="stat-label">警告数：</span>
                    <span class="stat-value">${eslintInfo.warningCount}</span>
                </div>
            </div>
        </div>`;

    const fileList = `
        <div class="file-list-section">
            <h3>违规详情</h3>
            ${eslintInfo.fileList.map(file => `
                <div class="eslint-file ${file.errorCount > 0 ? 'has-error' : ''} ${file.warningCount > 0 ? 'has-warning' : ''}">
                    <div class="eslint-file__header" onclick="window.toggleEslintMessageList(this)">
                        <span class="toggle-icon">▼</span>
                        <span class="file-path">${file.file}</span>
                        <span class="file-stats">
                            <span class="error-count">${file.errorCount} 错误</span>
                            <span class="warning-count">${file.warningCount} 警告</span>
                        </span>
                    </div>
                    <div class="eslint-file__messages">
                        ${file.messages.map(msg => `
                            <div class="eslint-message ${msg.severity === 2 ? 'eslint-message--error' : 'eslint-message--warning'}">
                                <span class="message-rule">${msg.rule}</span>
                                <span class="message-text">${msg.message}</span>
                                <span class="message-line">行 ${msg.line}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>`;

    return summary + fileList;
}

// 格式化Stylelint分析数据
function formatStylelintInfo(stylelintInfo) {
    if (!stylelintInfo) return '<p>无分析数据</p>';

    // 添加 toggle 函数（如果还没有添加）
    if (!window.toggleStylelintMessageList) {
        window.toggleStylelintMessageList = function(header) {
            const fileItem = header.parentElement;
            const messageList = fileItem.querySelector('.stylelint-file__messages');
            const toggleIcon = header.querySelector('.toggle-icon');
            
            if (messageList.style.display === 'none') {
                messageList.style.display = 'block';
                toggleIcon.textContent = '▼';
            } else {
                messageList.style.display = 'none';
                toggleIcon.textContent = '▶';
            }
        };
    }

    const summary = `
        <div class="summary-section">
            <div class="stylelint-summary">
                <div class="stylelint-stat">
                    <span class="stat-label">总文件数：</span>
                    <span class="stat-value">${stylelintInfo.totalFilesCount}</span>
                </div>
                <div class="stylelint-stat stylelint-stat--error">
                    <span class="stat-label">错误数：</span>
                    <span class="stat-value">${stylelintInfo.errorCount}</span>
                </div>
            </div>
        </div>`;

    const fileList = `
        <div class="file-list-section">
            <h3>违规详情</h3>
            ${stylelintInfo.fileList.map(file => `
                <div class="stylelint-file ${file.errorCount > 0 ? 'has-error' : ''} ${file.warningCount > 0 ? 'has-warning' : ''}">
                    <div class="stylelint-file__header" onclick="window.toggleStylelintMessageList(this)">
                        <span class="toggle-icon">▼</span>
                        <span class="file-path">${file.file}</span>
                        <span class="file-stats">
                            <span class="error-count">${file.errorCount} 错误</span>
                        </span>
                    </div>
                    <div class="stylelint-file__messages">
                        ${file.messages.map(msg => `
                            <div class="stylelint-message stylelint-message--error">
                                <span class="message-rule">${msg.rule || '样式规则'}</span>
                                <span class="message-text">${msg.text || msg.message}</span>
                                <span class="message-line">行 ${msg.line}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>`;

    // 初始化消息列表的显示状态
    setTimeout(() => {
        document.querySelectorAll('.stylelint-file__messages').forEach(list => {
            list.style.display = 'none';
            list.previousElementSibling.querySelector('.toggle-icon').textContent = '▶';
        });
    }, 0);

    return summary + fileList;
}

// 格式化Git分析数据
function formatGitInfo(gitInfo) {
    if (!gitInfo) return '<p>无分析数据</p>';

    // 文件类型统计
    const fileStatsHtml = `
        <div class="git-section">
            <div class="git-stats-grid">
                ${Object.entries(gitInfo.fileStats || {}).map(([ext, stats]) => `
                    <div class="git-stat-card">
                        <div class="git-stat-ext">${ext}</div>
                        <div class="git-stat-details">
                            <div>数量: ${stats.count}</div>
                            <div>大小: ${formatSize(stats.totalSize)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;

    // 命名规范问题
    const namingIssuesHtml = `
        <div class="git-section">
            <h3>命名规范问题</h3>
            <div class="naming-issues">
                <div class="issue-group">
                    <h4>目录命名问题 (${gitInfo.namingIssues?.directories?.length || 0})</h4>
                    <ul class="issue-list">
                        ${(gitInfo.namingIssues?.directories || []).map(dir => 
                            `<li class="monospace">${dir}</li>`
                        ).join('')}
                    </ul>
                </div>
                <div class="issue-group">
                    <h4>文件命名问题 (${gitInfo.namingIssues?.files?.length || 0})</h4>
                    <ul class="issue-list">
                        ${(gitInfo.namingIssues?.files || []).map(file => 
                            `<li class="monospace">${file}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
        </div>`;

    // Git 提交信息问题
    const invalidCommitsHtml = `
        <div class="git-section">
            <h3>不规范的提交信息</h3>
            <div class="commits-list">
                ${(gitInfo.invalidCommits || []).map(commit => `
                    <div class="commit-item">
                        <div class="commit-hash monospace">${commit.hash.slice(0, 8)}</div>
                        <div class="commit-message">${commit.message}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;

    // Git 配置检查
    const gitConfigHtml = `
        <div class="git-section">
            <h3>Git 配置检查</h3>
            <div class="config-checks">
                <div class="check-item ${gitInfo.huskyCheck?.isValid ? 'valid' : 'invalid'}">
                    <h4>Husky 配置</h4>
                    ${gitInfo.huskyCheck?.errors?.length ? `
                        <ul class="error-list">
                            ${gitInfo.huskyCheck.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    ` : '<div class="success">配置正确</div>'}
                </div>
                <div class="check-item ${gitInfo.gitignoreCheck?.isValid ? 'valid' : 'invalid'}">
                    <h4>.gitignore 配置</h4>
                    ${gitInfo.gitignoreCheck?.errors?.length ? `
                        <ul class="error-list">
                            ${gitInfo.gitignoreCheck.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    ` : '<div class="success">配置正确</div>'}
                </div>
            </div>
        </div>`;

    // 目录深度问题
    const directoryDepthHtml = `
        <div class="git-section">
            <h3>目录深度问题 (最大深度: ${gitInfo.directoryDepth?.maxDepth || 0})</h3>
            <div class="deep-directories">
                ${(gitInfo.directoryDepth?.deepDirectories || []).map(dir => `
                    <div class="directory-item">
                        <span class="depth-badge">深度 ${dir.depth}</span>
                        <span class="directory-path monospace">${dir.path}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;

    return `
        <div class="git-container">
            ${fileStatsHtml}
            ${namingIssuesHtml}
            ${invalidCommitsHtml}
            ${gitConfigHtml}
            ${directoryDepthHtml}
        </div>
    `;
}

// 格式化工程配置分析数据
function formatConfigInfo(configInfo) {
    if (!configInfo) return '<p>无分析数据</p>';

    // 配置项及其对应的图标和描述
    const configItems = {
        commitlint: { icon: '📝', name: 'Commitlint', desc: 'Git提交信息规范配置' },
        prettier: { icon: '✨', name: 'Prettier', desc: '代码格式化配置' },
        readme: { icon: '📚', name: 'README', desc: '项目文档' },
        npmrc: { icon: '📦', name: '.npmrc', desc: 'NPM配置' },
        eslint: { icon: '🔍', name: 'ESLint', desc: '代码检查配置' },
        tsconfig: { icon: '⚙️', name: 'TSConfig', desc: 'TypeScript配置' },
        nodeVersion: { icon: '🟢', name: 'Node版本', desc: '运行环境版本' },
        editorconfig: { icon: '📐', name: 'EditorConfig', desc: '编辑器配置' },
        packageJson: { icon: '📄', name: 'package.json', desc: '项目配置文件' },
        browserslist: { icon: '🌐', name: 'Browserslist', desc: '目标浏览器配置' }
    };

    const html = `
        <div class="config-container">
            <div class="config-grid">
                ${Object.entries(configItems).map(([key, item]) => {
                    const config = configInfo[key];
                    if (!config) return '';
                    
                    return `
                        <div class="config-card ${config.isValid ? 'valid' : 'invalid'}">
                            <div class="config-header">
                                <span class="config-icon">${item.icon}</span>
                                <span class="config-title">${item.name}</span>
                                <span class="config-status ${config.isValid ? 'success' : 'error'}">
                                    ${config.isValid ? '✓' : '✗'}
                                </span>
                            </div>
                            <div class="config-desc">${item.desc}</div>
                            <div class="config-details">
                                ${config.exists ? 
                                    config.isValid ? 
                                        `<div class="success-msg">配置正确</div>` :
                                        `<div class="error-list">
                                            ${(config.errors || []).map(error => 
                                                `<div class="error-item">• ${error}</div>`
                                            ).join('')}
                                        </div>`
                                    : `<div class="error-msg">文件不存在</div>`
                                }
                                ${config.filePath ? 
                                    `<div class="config-file-path">📎 ${config.filePath}</div>` : ''
                                }
                                ${config.version ? 
                                    `<div class="config-version-info">📌 ${config.version}</div>` : ''
                                }
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    return html;
}

// 格式化可读性检查数据
function formatCountInfo(countInfo) {
    if (!countInfo || !countInfo.functionStats) {
        return '<p>无分析数据</p>';
    }

    const stats = countInfo.functionStats;
    const html = `
        <div class="function-stats-container">
            <div class="function-stats-header">
                <h3>函数类型检查统计</h3>
                <div class="function-stats-summary">
                    <div class="function-stat-item ${stats.missingTypes === 0 ? 'success' : 'warning'}">
                        <span class="function-stat-label">总函数数量:</span>
                        <span class="function-stat-value">${stats.total}</span>
                    </div>
                    <div class="function-stat-item ${stats.missingTypes === 0 ? 'success' : 'warning'}">
                        <span class="function-stat-label">缺少类型定义的函数:</span>
                        <span class="function-stat-value">${stats.missingTypes}</span>
                    </div>
                </div>
            </div>

            ${stats.missingTypes > 0 ? `
                <div class="missing-types-section">
                    <h4>缺少类型定义的函数列表:</h4>
                    <div class="function-file-list">
                        ${groupByFile(stats.functionsWithMissingTypes).map(({file, functions}) => `
                            <div class="function-file-group">
                                <div class="function-file-header" onclick="this.parentElement.classList.toggle('expanded')">
                                    <span class="function-expand-icon">▶</span>
                                    <span class="function-file-path">${file}</span>
                                    <span class="function-file-count">(${functions.length})</span>
                                </div>
                                <div class="function-list">
                                    ${functions.map(fn => `
                                        <div class="function-item">
                                            <span class="function-name">${fn.name === 'anonymous' ? '匿名函数' : fn.name}</span>
                                            ${!fn.hasParameterTypes ? 
                                                '<span class="function-type-missing">缺少参数类型</span>' : 
                                                ''
                                            }
                                            ${!fn.hasReturnType ? 
                                                '<span class="function-type-missing">缺少返回类型</span>' : 
                                                ''
                                            }
                                            <span class="function-line">第 ${fn.line} 行</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    return html;
}

// 按文件分组函数
function groupByFile(functions) {
    const groups = {};
    functions.forEach(fn => {
        if (!groups[fn.file]) {
            groups[fn.file] = [];
        }
        groups[fn.file].push(fn);
    });
    return Object.entries(groups).map(([file, functions]) => ({file, functions}));
}

// 格式化代码冗余检查数据
function formatRedundancyInfo(redundancyInfo) {
    if (!redundancyInfo) {
        return '<p>无重复代码分析数据</p>';
    }

    // 添加 toggle 函数（如果还没有添加）
    if (!window.toggleCloneGroup) {
        window.toggleCloneGroup = function(header) {
            const fileItem = header.parentElement;
            const messageList = fileItem.querySelector('.clone-files-list');
            const toggleIcon = header.querySelector('.clone-arrow');
            
            if (messageList.style.display === 'none') {
                messageList.style.display = 'block';
                toggleIcon.textContent = '▼';
            } else {
                messageList.style.display = 'none';
                toggleIcon.textContent = '▶';
            }
        };
    }
    
    const html = `
        <div class="redundancy-container">
            <div class="redundancy-header">
                <h3>代码重复分析</h3>
                <div class="redundancy-summary">
                    <div class="stat-item ${redundancyInfo.duplicates > 0 ? 'warning' : 'success'}">
                        <span class="stat-label">检查总文件数:</span>
                        <span class="stat-value">${redundancyInfo.total}</span>
                    </div>
                    <div class="stat-item ${redundancyInfo.duplicates > 0 ? 'warning' : 'success'}">
                        <span class="stat-label">重复项目数:</span>
                        <span class="stat-value">${redundancyInfo.duplicates}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">波及文件数:</span>
                        <span class="stat-value">${redundancyInfo.files}</span>
                    </div>
                </div>
            </div>

            <div class="clones-container">
                ${redundancyInfo.clones.map((clone, index) => `
                    <div class="clone-group">
                        <div class="clone-header" onclick="window.toggleCloneGroup(this)">
                            <span class="clone-arrow">▶</span>
                            <span class="clone-title">重复代码块 #${index + 1}</span>
                            <span class="clone-info">
                                <span class="clone-files">${clone.files.length} 个文件</span>
                                <span class="clone-lines">${clone.lines} 行</span>
                            </span>
                        </div>
                        <div class="clone-files-list">
                            ${redundancyInfo.clones[index].files.map(file => `
                                <div class="clone-file">
                                    <div class="clone-file-path">${file.name}</div>
                                    <div class="clone-file-lines">第 ${file.startLine} - ${file.endLine} 行</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

     // 初始化消息列表的显示状态
    setTimeout(() => {
        document.querySelectorAll('.clone-files-list').forEach(list => {
            list.style.display = 'none';
            list.previousElementSibling.querySelector('.clone-arrow').textContent = '▶';
        });
    }, 0);

    return html;
}   