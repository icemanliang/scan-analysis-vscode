(function() {
    const vscode = acquireVsCodeApi();
    const startScanButton = document.getElementById('startScan');
    const loadingElement = document.getElementById('loading');
    const resultsElement = document.getElementById('results');
    
    startScanButton.addEventListener('click', () => {
        // 显示加载状态
        startScanButton.disabled = true;
        loadingElement.style.display = 'block';
        resultsElement.style.display = 'none';
        
        vscode.postMessage({ command: 'startScan' });
    });

    // 处理扫描结果
    window.addEventListener('message', event => {
        const message = event.data;
        
        if (message.command === 'scanComplete') {
            // 隐藏加载状态
            startScanButton.disabled = false;
            loadingElement.style.display = 'none';
            resultsElement.style.display = 'block';
            
            // 显示结果
            const resultsFile = message.results.scanResults[0].resultFile;
            if(fs.existsSync(resultsFile)){
                const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
                displayResults(results);
            }
        }
    });

    function displayResults(results) {
        const resultsHeader = resultsElement.querySelector('.results-header');
        const qualityScore = resultsElement.querySelector('.quality-score');
        const issuesSummary = resultsElement.querySelector('.issues-summary');
        const detailedResults = resultsElement.querySelector('.detailed-results');

        // 显示时间戳
        resultsHeader.style.display = 'flex';
        resultsHeader.querySelector('.timestamp').textContent = 
            `扫描时间: ${new Date().toLocaleString()}`;

        // 显示质量评分
        qualityScore.innerHTML = `
            <h2>代码质量评分</h2>
            <div class="score-circle">
                <span class="score">${results.qualityInfo.qualityScore.total}</span>
                <span class="max-score">/ ${results.qualityInfo.qualityScore.maxScore}</span>
            </div>
        `;

        // 显示问题汇总
        issuesSummary.innerHTML = `
            <div class="issue-card">
                <h3>ESLint 问题</h3>
                <p>错误: ${results.eslintInfo.errorCount}</p>
                <p>警告: ${results.eslintInfo.warningCount}</p>
            </div>
            <div class="issue-card">
                <h3>代码重复</h3>
                <p>重复文件: ${results.qualityInfo.redundancyInfo.duplicatesCount}</p>
            </div>
            <div class="issue-card">
                <h3>依赖分析</h3>
                <p>总依赖数: ${Object.keys(results.dependencyInfo || {}).length}</p>
            </div>
        `;

        // 显示详细结果
        detailedResults.innerHTML = `
            <h2>详细问题列表</h2>
            <div class="issues-list">
                ${generateIssuesList(results.eslintInfo.fileList)}
            </div>
        `;
    }

    function generateIssuesList(fileList) {
        return fileList.map(file => `
            <div class="file-issues">
                <h3>${file.filePath}</h3>
                <ul>
                    ${file.messages.map(msg => `
                        <li class="issue-item ${msg.severity === 2 ? 'error' : 'warning'}">
                            ${msg.message} (${msg.rule}) - 行 ${msg.line}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('');
    }
})(); 