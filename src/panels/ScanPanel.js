const vscode = require('vscode');
const path = require('path');
const scanService = require('../services/scanService');

class ScanPanel {
    static currentPanel;
    static viewType = 'codeScan';

    constructor(panel, extensionUri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._disposables = [];

        this._panel.onDidChangeViewState(
            e => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

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

        // 创建webview面板
        const panel = vscode.window.createWebviewPanel(
            ScanPanel.viewType,
            '代码扫描分析',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
                enableDevTools: true
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
        // 获取文件路径
        // const htmlPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'panels', 'webview', 'index.html'));
        const stylePath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'panels', 'webview', 'styles.css'));
        const scriptPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'panels', 'webview', 'script.js'));
        
        // 读取文件内容
        const htmlContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this._extensionUri, 'src', 'panels', 'webview', 'index.html'));
        
        // 替换文件路径
        return htmlContent.toString()
            .replace('${stylePath}', stylePath)
            .replace('${scriptPath}', scriptPath);
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
                                        { name: 'redundancy-check-plugin', config: { maxFilesLimit: 15000 } },
                                        { name: 'git-check-plugin', config: {} },
<<<<<<< HEAD
                                        { name: 'config-check-plugin', config: { npmrc: { registryDomain: 'https://npmjs.iceman.cn' } } },
=======
                                        { name: 'config-check-plugin', config: {} },
>>>>>>> f7734694a49a94a4d14afd3dd7ebb885fcc61c35
                                        { name: 'package-check-plugin', config: {} },
                                        { name: 'dependency-check-plugin', config: {} },
                                        { name: 'quality-analysis-plugin', config: {} }
                                    ]
                                };

                                try {
                                    const results = await scanService.scanProject(scanOptions);
                                    const scanResultsFilePath = results.scanResults[0].resultFile;
                                    // console.log(scanResultsFilePath);
                                    const scanResultsFileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(scanResultsFilePath));
                                    const scanResultsFileContentString = Buffer.from(scanResultsFileContent).toString('utf-8');
                                    // console.log(scanResultsFileContentString);
                                    progress.report({ increment: 100 });

                                    webview.postMessage({
                                        command: 'scanComplete',
                                        results: scanResultsFileContentString
                                    });
                                } catch (error) {
                                    console.error('扫描失败:', error);
                                    vscode.window.showErrorMessage(`扫描失败: ${error.message || '未知错误'}`);
                                }
                            });
                        } catch (error) {
                            vscode.window.showErrorMessage(`扫描失败: ${error.message || '未知错误'}`);
                        }
                    break;
                    case 'log':
                        console.log(message.text);
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