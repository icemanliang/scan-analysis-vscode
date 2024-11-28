const vscode = require('vscode');
const { ScanPanel } = require('./panels/ScanPanel');

function activate(context) {

    // 注册扫描命令
    let disposable = vscode.commands.registerCommand('code-scan.startScan', () => {
        ScanPanel.createOrShow(context.extensionUri);
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};