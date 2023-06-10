import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('FindFiles', async function () {
        let panel = vscode.window.createWebviewPanel(
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
}

async function findFiles(context: vscode.ExtensionContext, input?: string) {
    let pattern = input?.split(",")[0];
    if (pattern) {
        // 大文字小文字を区別せずに検索する正規表現パターン
        // pattern文字列でフィルタ
        const regexPattern = convertWildcardToRegex(pattern);
        const patternRegex = new RegExp(`^${regexPattern}$`, 'i');
        let files = (await vscode.workspace.findFiles('**/*', null)).sort();
        files = files.filter(file => patternRegex.test(path.basename(file.path)));
        let exclude = input?.split(",")[1];
        if (exclude) {
            const excludeRegexPattern = convertWildcardToRegex(exclude);
            const excludeRegex = new RegExp(`^${excludeRegexPattern}$`, 'i');
            files = files.filter(file => !excludeRegex.test(path.basename(file.path)));
        }
        if (files.length > 0) {
            // ファイルパス一覧を文字列に変換
            let content = "Find Results(Ctrl or Alt + Click To Jump) pattern = " + pattern + "\n";
            content += files.map(file => file.fsPath).join('\n');
            // 新たなテキストエディターを開く
            let document = await vscode.workspace.openTextDocument({ content });
            await vscode.window.showTextDocument(document);
            // ドキュメントリンクプロバイダーを登録
            context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(document.uri, new FileLinkProvider()));
        } else {
            // 一致するファイルがない場合はメッセージを表示
            vscode.window.showInformationMessage('No matching files found.');
        }
    }
}

function convertWildcardToRegex(wildcard: string): string {
    return wildcard
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 特殊文字をエスケープ
        .replace(/\\\*/g, '.*') // ワイルドカードを正規表現パターンに変換
        .replace(/^\\\*|\\\*$/g, ''); // 先頭と末尾のワイルドカードを削除
}

// ドキュメントリンクプロバイダー
class FileLinkProvider implements vscode.DocumentLinkProvider {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
        // ドキュメント内の全ての行に対して、ファイルパスからURIオブジェクトと範囲オブジェクトを作成し、
        // ドキュメントリンクオブジェクトに変換
        let index = 0;
        let links: vscode.DocumentLink[] = [];
        document.getText().split('\n').forEach(line => {
            // ファイルパスのみリンクを生成
            if (fs.existsSync(line)) {
                let range = new vscode.Range(new vscode.Position(index, 0), new vscode.Position(index, line.length));
                let uri = vscode.Uri.file(line);
                links.push(new vscode.DocumentLink(range, uri));
            }
            index++;
        });
        return links;
    }
}

exports.activate = activate;

function deactivate() { }

exports.deactivate = deactivate;