"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.activate = void 0;
var vscode = require("vscode");
var fs = require("fs");
var path = require("path");
function activate(context) {
    var disposable = vscode.commands.registerCommand('FindFiles', function () {
        return __awaiter(this, void 0, void 0, function () {
            var panel, htmlPath, htmlContent;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        panel = vscode.window.createWebviewPanel('form', 'FindFiles', vscode.ViewColumn.One, {
                            enableScripts: true,
                            retainContextWhenHidden: true
                        });
                        htmlPath = vscode.Uri.file(path.join(context.extensionPath, 'resources', 'index.html'));
                        return [4 /*yield*/, vscode.workspace.fs.readFile(htmlPath)];
                    case 1:
                        htmlContent = _a.sent();
                        panel.webview.html = htmlContent.toString();
                        panel.webview.onDidReceiveMessage(function (message) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _a = message.command;
                                        switch (_a) {
                                            case 'submit': return [3 /*break*/, 1];
                                        }
                                        return [3 /*break*/, 3];
                                    case 1:
                                        if (!message.text) {
                                            return [2 /*return*/];
                                        }
                                        return [4 /*yield*/, findFiles(context, message.text)];
                                    case 2:
                                        _b.sent();
                                        return [2 /*return*/];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }, undefined, context.subscriptions);
                        return [2 /*return*/];
                }
            });
        });
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function findFiles(context, input) {
    return __awaiter(this, void 0, void 0, function () {
        var pattern, regexPattern, patternRegex_1, files, exclude, excludeRegexPattern, excludeRegex_1, content, document_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pattern = input === null || input === void 0 ? void 0 : input.split(",")[0];
                    if (!pattern) return [3 /*break*/, 5];
                    regexPattern = convertWildcardToRegex(pattern);
                    patternRegex_1 = new RegExp("^".concat(regexPattern, "$"), 'i');
                    return [4 /*yield*/, vscode.workspace.findFiles('**/*', null)];
                case 1:
                    files = (_a.sent()).sort();
                    files = files.filter(function (file) { return patternRegex_1.test(path.basename(file.path)); });
                    exclude = input === null || input === void 0 ? void 0 : input.split(",")[1];
                    if (exclude) {
                        excludeRegexPattern = convertWildcardToRegex(exclude);
                        excludeRegex_1 = new RegExp("^".concat(excludeRegexPattern, "$"), 'i');
                        files = files.filter(function (file) { return !excludeRegex_1.test(path.basename(file.path)); });
                    }
                    if (!(files.length > 0)) return [3 /*break*/, 4];
                    content = "Find Results(Ctrl or Alt + Click To Jump) pattern = " + pattern + "\n";
                    content += files.map(function (file) { return file.fsPath; }).join('\n');
                    return [4 /*yield*/, vscode.workspace.openTextDocument({ content: content })];
                case 2:
                    document_1 = _a.sent();
                    return [4 /*yield*/, vscode.window.showTextDocument(document_1)];
                case 3:
                    _a.sent();
                    // ドキュメントリンクプロバイダーを登録
                    context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(document_1.uri, new FileLinkProvider()));
                    return [3 /*break*/, 5];
                case 4:
                    // 一致するファイルがない場合はメッセージを表示
                    vscode.window.showInformationMessage('No matching files found.');
                    _a.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function convertWildcardToRegex(wildcard) {
    return wildcard
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 特殊文字をエスケープ
        .replace(/\\\*/g, '.*') // ワイルドカードを正規表現パターンに変換
        .replace(/^\\\*|\\\*$/g, ''); // 先頭と末尾のワイルドカードを削除
}
// ドキュメントリンクプロバイダー
var FileLinkProvider = /** @class */ (function () {
    function FileLinkProvider() {
    }
    FileLinkProvider.prototype.provideDocumentLinks = function (document) {
        // ドキュメント内の全ての行に対して、ファイルパスからURIオブジェクトと範囲オブジェクトを作成し、
        // ドキュメントリンクオブジェクトに変換
        var index = 0;
        var links = [];
        document.getText().split('\n').forEach(function (line) {
            // ファイルパスのみリンクを生成
            if (fs.existsSync(line)) {
                var range = new vscode.Range(new vscode.Position(index, 0), new vscode.Position(index, line.length));
                var uri = vscode.Uri.file(line);
                links.push(new vscode.DocumentLink(range, uri));
            }
            index++;
        });
        return links;
    };
    return FileLinkProvider;
}());
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map