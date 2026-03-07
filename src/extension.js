"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

class FindFilesViewProvider {
    constructor(_extensionPath, _context) {
        this._extensionPath = _extensionPath;
        this._context = _context;
    }

    resolveWebviewView(webviewView, _context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
        };
        const htmlPath = vscode.Uri.file(
            path.join(this._extensionPath, 'resources', 'index.html')
        );
        vscode.workspace.fs.readFile(htmlPath).then(htmlContent => {
            webviewView.webview.html = htmlContent.toString();
        });
        webviewView.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'submit':
                        if (!message.text) {
                            return;
                        }
                        await findFiles(this._context, message.text);
                        return;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }
}

async function activate(context) {
    const disposable = vscode.commands.registerCommand('FindFiles', async function () {
        const panel = vscode.window.createWebviewPanel(
            'form',
            'FindFiles',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );
        const htmlPath = vscode.Uri.file(
            path.join(context.extensionPath, 'resources', 'index.html')
        );
        const htmlContent = await vscode.workspace.fs.readFile(htmlPath);
        panel.webview.html = htmlContent.toString();
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'submit':
                        if (!message.text) {
                            return;
                        }
                        await findFiles(context, message.text);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });
    context.subscriptions.push(disposable);

    const findFilesViewProvider = new FindFilesViewProvider(context.extensionPath, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('findFilesView', findFilesViewProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );
}
exports.activate = activate;

async function findFiles(context, input) {
    const pattern = input?.split(",")[0];
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Searching files...",
        cancellable: false
    }, async (progress) => {
        if (pattern) {
            const regexPattern = convertWildcardToRegex(pattern);
            const patternRegex = new RegExp(`^${regexPattern}$`, 'i');
            let files = (await vscode.workspace.findFiles('**/*', null)).sort();
            const isInclude = input && input.split(",")[1] === "true";
            if (isInclude) {
                files = files.filter(file => patternRegex.test(file.path));
            } else {
                files = files.filter(file => patternRegex.test(path.basename(file.path)));
            }
            let exclude = input?.split(",")[2];
            if (exclude) {
                const excludeRegexPattern = convertWildcardToRegex(exclude);
                const excludeRegex = new RegExp(`^${excludeRegexPattern}$`, 'i');
                if (isInclude) {
                    files = files.filter(file => !excludeRegex.test(file.path));
                } else {
                    files = files.filter(file => !excludeRegex.test(path.basename(file.path)));
                }
            }
            if (files.length > 0) {
                let content = `Find Results(Ctrl or Alt + Click To Jump) Pattern = ${pattern}, IncludeFolder = ${isInclude}, Exclude = ${exclude !== "" ? exclude : "None"} \n`;
                content += files.map(file => file.fsPath).join('\n');
                let document = await vscode.workspace.openTextDocument({ content });
                await vscode.window.showTextDocument(document);
                context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(document.uri, new FileLinkProvider()));
            } else {
                vscode.window.showInformationMessage('No matching files found.');
            }
        }
    });
}

function convertWildcardToRegex(wildcard) {
    return wildcard
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '.*')
        .replace(/^\\\*|\\\*$/g, '');
}

class FileLinkProvider {
    provideDocumentLinks(document) {
        let index = 0;
        let links = [];
        document.getText().split('\n').forEach(line => {
            if (fs.existsSync(line)) {
                const range = new vscode.Range(new vscode.Position(index, 0), new vscode.Position(index, line.length));
                const uri = vscode.Uri.file(line);
                links.push(new vscode.DocumentLink(range, uri));
            }
            index++;
        });
        return links;
    }
}

function deactivate() { }
exports.deactivate = deactivate;
