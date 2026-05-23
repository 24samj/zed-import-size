"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const imports_1 = require("./imports");
const measure_1 = require("./measure");
const WARNING_THRESHOLD_KB = 100;
const DEBOUNCE_MS = 500;
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const importSizeCache = new Map();
const pendingRefreshes = new Map();
const docImportHints = new Map();
let workspaceRoot = process.cwd();
function parseWorkspaceRoot(params) {
    if (params.rootUri?.startsWith('file://')) {
        return decodeURIComponent(params.rootUri.replace('file://', ''));
    }
    if (params.rootPath) {
        return params.rootPath;
    }
    if (params.workspaceFolders && params.workspaceFolders.length > 0) {
        const uri = params.workspaceFolders[0].uri;
        if (uri.startsWith('file://')) {
            return decodeURIComponent(uri.replace('file://', ''));
        }
    }
    return process.cwd();
}
async function measureImportSizeKb(entry) {
    const cached = importSizeCache.get(entry.cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const sizeKb = await (0, measure_1.measurePackageSizeKb)({
        measurementSource: entry.measurementSource,
        packageName: entry.packageName,
        workspaceRoot,
    });
    if (sizeKb !== null) {
        importSizeCache.set(entry.cacheKey, sizeKb);
    }
    return sizeKb;
}
async function computeInlayHintsForDocument(document) {
    const imports = (0, imports_1.collectPackageImports)(document.getText());
    const hints = [];
    for (const entry of imports) {
        const sizeKb = await measureImportSizeKb(entry);
        if (sizeKb === null) {
            continue;
        }
        const lineText = document.getText({
            start: { line: entry.line, character: 0 },
            end: { line: entry.line + 1, character: 0 },
        }).replace(/\r?\n$/, '');
        const warning = sizeKb > WARNING_THRESHOLD_KB ? ' ⚠' : '';
        hints.push({
            position: { line: entry.line, character: lineText.length },
            label: `// ${sizeKb.toFixed(1)} kb${warning}`,
            kind: node_1.InlayHintKind.Type,
            paddingLeft: true,
        });
    }
    docImportHints.set(document.uri, hints);
}
function scheduleDocumentRefresh(document) {
    const existing = pendingRefreshes.get(document.uri);
    if (existing) {
        clearTimeout(existing);
    }
    const timer = setTimeout(() => {
        pendingRefreshes.delete(document.uri);
        void computeInlayHintsForDocument(document).then(() => {
            connection.languages.inlayHint.refresh();
        });
    }, DEBOUNCE_MS);
    pendingRefreshes.set(document.uri, timer);
}
connection.onInitialize((params) => {
    workspaceRoot = parseWorkspaceRoot(params);
    importSizeCache.clear();
    return {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            inlayHintProvider: true,
        },
    };
});
connection.onInitialized(() => {
    connection.client.register(vscode_languageserver_protocol_1.InlayHintRequest.type);
});
documents.onDidOpen((event) => {
    void computeInlayHintsForDocument(event.document).then(() => {
        connection.languages.inlayHint.refresh();
    });
});
documents.onDidChangeContent((event) => {
    scheduleDocumentRefresh(event.document);
});
connection.languages.inlayHint.on(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return docImportHints.get(params.textDocument.uri) ?? [];
    }
    await computeInlayHintsForDocument(document);
    return docImportHints.get(params.textDocument.uri) ?? [];
});
documents.listen(connection);
connection.listen();
