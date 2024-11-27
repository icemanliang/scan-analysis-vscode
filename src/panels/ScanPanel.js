const vscode = require('vscode');
const path = require('path');
const scanService = require('../services/scanService');

class ScanPanel {
    static currentPanel;

    constructor(panel, extensionUri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._disposables = [];

        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ScanPanel.currentPanel) {
            ScanPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'codeScan',
            '代码扫描分析',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri]
            }
        );

        ScanPanel.currentPanel = new ScanPanel(panel, extensionUri);
    }

    async _update() {
        const webview = this._panel.webview;
        // 确保 getWebviewContent 函数存在
        this._panel.webview.html = await this._getWebviewContent(webview);
        this._setWebviewMessageListener(webview);
    }

    // 添加获取 webview 内容的方法
    async _getWebviewContent(webview) {
        // 返回基本的 HTML 结构
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>代码扫描分析</title>
            </head>
            <body>
                <button id="startScan">开始扫描</button>
                <div id="results"></div>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('startScan').addEventListener('click', () => {
                        vscode.postMessage({ command: 'startScan' });
                    });
                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'scanComplete') {
                            document.getElementById('results').innerHTML = 
                                JSON.stringify(message.results, null, 2);
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    _setWebviewMessageListener(webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'startScan':
                        try {
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (!workspaceFolders) {
                                vscode.window.showErrorMessage('请先打开一个项目文件夹');
                                return;
                            }

                            await vscode.window.withProgress({
                                location: vscode.ProgressLocation.Notification,
                                title: "正在扫描代码...",
                                cancellable: false
                            }, async (progress) => {
                                progress.report({ increment: 0 });
                                
                                const scanOptions = {
                                    resultDir: path.join(workspaceFolders[0].uri.fsPath, 'scan-results'),
                                    sources: [{
                                        appName: 'lcps',
                                        baseDir: workspaceFolders[0].uri.fsPath,
                                        codeDir: 'src',
                                        buildDir: '',
                                        aliasConfig: {}
                                    }],
                                    plugins: [
                                        { name: 'eslint-check-plugin', config: {} },
                                        { name: 'stylelint-check-plugin', config: {} },
                                        { name: 'count-check-plugin', config: {} },
                                        // { name: 'redundancy-check-plugin', config: { maxFilesLimit: 15000 } },
                                        { name: 'git-check-plugin', config: {} },
                                        { name: 'config-check-plugin', config: { npmrc: { registryDomain: 'https://npmjs.iceman.cn' } } },
                                        { name: 'package-check-plugin', config: { privatePackagePrefix: ['@shein'], riskThreshold: { isCheck: false } } },
                                        { name: 'dependency-check-plugin', config: { ignoreMatch: ['src/component/', '__tests__/'] } },
                                        { name: 'quality-analysis-plugin', config: {} }
                                    ]
                                };

                                const results = await scanService.scanProject(scanOptions);
                                progress.report({ increment: 100 });

                                webview.postMessage({
                                    command: 'scanComplete',
                                    results: results
                                });
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`扫描失败: ${error.message || '未知错误'}`);
                        }
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    dispose() {
        ScanPanel.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

module.exports = {
    ScanPanel
};