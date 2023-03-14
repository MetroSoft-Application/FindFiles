import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // コマンド登録
    let command = vscode.commands.registerCommand('FindFiles', async () => {
        // ユーザにファイルパターンを入力させる
        let pattern = await vscode.window.showInputBox({ prompt: 'Enter a file pattern' });
        if (pattern) {
            // 大文字小文字を区別せずに検索する正規表現パターン
            const searchRegex = new RegExp(pattern, 'i');
            let files = await vscode.workspace.findFiles('**/*', null);
            // 正規表現でフィルタ
            files = files.filter(file => searchRegex.test(path.basename(file.path)));
            if (files.length > 0) {
                // ファイルパス一覧を文字列に変換
                let content = "Find Results(Alt + Click To Jump)" + "\n";
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
    });
    context.subscriptions.push(command);
}

export function deactivate() { }

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