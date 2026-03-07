import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * アクティビティバーのサイドバーに FindFiles の WebviewView を提供するプロバイダー。
 */
class FindFilesViewProvider implements vscode.WebviewViewProvider {
    /** 現在表示中の WebviewView への参照。履歴の動的更新に使用する。 */
    private _view?: vscode.WebviewView;

    /**
     * @param _extensionPath 拡張機能のルートパス
     * @param _context 拡張機能のコンテキスト
     */
    constructor(
        private readonly _extensionPath: string,
        private readonly _context: vscode.ExtensionContext
    ) { }

    /**
     * WebviewView が表示されるときに呼び出され、HTML の読み込みとメッセージハンドラを設定する。
     * @param webviewView 表示対象の WebviewView
     * @param _context リゾルブコンテキスト（未使用）
     * @param _token キャンセルトークン（未使用）
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        webviewView.webview.options = {
            enableScripts: true,
        };
        const htmlPath = vscode.Uri.file(
            path.join(this._extensionPath, 'resources', 'index.html')
        );
        this._view = webviewView;
        vscode.workspace.fs.readFile(htmlPath).then(htmlContent => {
            const patternHistory = this._context.globalState.get<string[]>('findFilesPatternHistory', []);
            const excludeHistory = this._context.globalState.get<string[]>('findFilesExcludeHistory', []);
            const historyScript = `<script>window.__patternHistory=${JSON.stringify(patternHistory)};window.__excludeHistory=${JSON.stringify(excludeHistory)};<\/script>`;
            const html = htmlContent.toString().replace('</body>', historyScript + '\n</body>');
            webviewView.webview.html = html;
        });
        webviewView.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'submit':
                        if (!message.text) {
                            return;
                        }
                        await findFiles(this._context, message.text);
                        webviewView.webview.postMessage({
                            command: 'updateHistory',
                            patterns: this._context.globalState.get<string[]>('findFilesPatternHistory', []),
                            excludes: this._context.globalState.get<string[]>('findFilesExcludeHistory', []),
                        });
                        return;
                }
            },
            undefined,
            this._context.subscriptions
        );
    }
}

/**
 * 拡張機能が有効化されたときに呼び出されるエントリポイント。
 * コマンド（WebviewPanel）と WebviewViewProvider（サイドバー）を登録する。
 * @param context 拡張機能のコンテキスト
 */
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

    const findFilesViewProvider = new FindFilesViewProvider(context.extensionPath, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('findFilesView', findFilesViewProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );
}

/** 検索履歴の最大保存件数。 */
const HISTORY_MAX = 10;

/**
 * 検索履歴を globalState に保存する。同一値は重複を排除し、先頭に追加する。
 * @param context 拡張機能のコンテキスト
 * @param key globalState のキー
 * @param value 保存する値（空文字の場合は無視）
 */
function saveHistory(context: vscode.ExtensionContext, key: string, value: string): void {
    if (!value) { return; }
    const history = context.globalState.get<string[]>(key, []);
    const updated = [value, ...history.filter(h => h !== value)].slice(0, HISTORY_MAX);
    context.globalState.update(key, updated);
}

/**
 * 入力パターンに基づいてワークスペース内のファイルを検索し、結果をテキストエディターに表示する。
 * @param context 拡張機能のコンテキスト（DocumentLinkProvider の登録に使用）
 * @param input カンマ区切りの検索パラメーター文字列。
 *   - [0]: ファイル名パターン（ワイルドカード使用可）
 *   - [1]: "true" の場合はパス全体に対してマッチング（フォルダを含む）
 *   - [2]: 除外パターン（省略可）
 */
async function findFiles(context: vscode.ExtensionContext, input?: string) {
    let pattern = input?.split(",")[0];
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Searching files...",
        cancellable: false
    }, async (progress) => {
        // 大文字小文字を区別せずに検索する正規表現パターン
        // pattern文字列でフィルタ
        if (pattern) {
            saveHistory(context, 'findFilesPatternHistory', pattern);
            const regexPattern = convertWildcardToRegex(pattern);
            const patternRegex = new RegExp(`^${regexPattern}$`, 'i');
            let files = (await vscode.workspace.findFiles('**/*', null)).sort();
            const isInclude = input && input.split(",")[1] === "true";
            if (isInclude) {
                // files = files.filter(file => patternRegex.test(path.dirname(file.path) || path.basename(file.path)));
                files = files.filter(file => patternRegex.test(file.path));
            } else {
                files = files.filter(file => patternRegex.test(path.basename(file.path)));
            }
            let exclude = input?.split(",")[2];
            if (exclude) {
                saveHistory(context, 'findFilesExcludeHistory', exclude);
                const excludeRegexPattern = convertWildcardToRegex(exclude);
                const excludeRegex = new RegExp(`^${excludeRegexPattern}$`, 'i');
                if (isInclude) {
                    // files = files.filter(file => !excludeRegex.test(file.path || path.basename(file.path)));
                    files = files.filter(file => !excludeRegex.test(file.path));
                } else {
                    files = files.filter(file => !excludeRegex.test(path.basename(file.path)));
                }
            }
            if (files.length > 0) {
                // ファイルパス一覧を文字列に変換
                let content = `Find Results(Ctrl or Alt + Click To Jump) Pattern = ${pattern}, IncludeFolder = ${isInclude}, Exclude = ${exclude !== "" ? exclude : "None"} \n`;

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
    // }
}

/**
 * ワイルドカード文字列を正規表現パターン文字列に変換する。
 * `*` は `.*` に変換され、その他の正規表現特殊文字はエスケープされる。
 * @param wildcard 変換対象のワイルドカード文字列
 * @returns 正規表現パターン文字列
 */
function convertWildcardToRegex(wildcard: string): string {
    return wildcard
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 特殊文字をエスケープ
        .replace(/\\\*/g, '.*') // ワイルドカードを正規表現パターンに変換
        .replace(/^\\\*|\\\*$/g, ''); // 先頭と末尾のワイルドカードを削除
}

/**
 * 検索結果ドキュメント内のファイルパスをクリッカブルリンクに変換するプロバイダー。
 */
class FileLinkProvider implements vscode.DocumentLinkProvider {
    /**
     * ドキュメント内の各行を検査し、実在するファイルパスに対してドキュメントリンクを生成する。
     * @param document リンクを検索する対象のテキストドキュメント
     * @returns ファイルパス行に対応する DocumentLink の配列
     */
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
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