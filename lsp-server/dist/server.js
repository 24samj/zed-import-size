"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const esbuild_1 = require("esbuild");
const node_zlib_1 = require("node:zlib");
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const IMPORT_REGEX = /^import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/gm;
const WARNING_THRESHOLD_KB = 100;
const DEBOUNCE_MS = 500;
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const importSizeCache = new Map();
const pendingRefreshes = new Map();
const docImportHints = new Map();
let workspaceRoot = process.cwd();
function isNpmPackage(specifier) {
    return !specifier.startsWith('.') && !specifier.startsWith('/');
}
function extractPackageName(specifier) {
    if (specifier.startsWith('@')) {
        return specifier.split('/').slice(0, 2).join('/');
    }
    return specifier.split('/')[0];
}
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
function collectPackageImports(text) {
    const imports = [];
    for (const match of text.matchAll(IMPORT_REGEX)) {
        const specifier = match[1];
        if (!specifier || !isNpmPackage(specifier)) {
            continue;
        }
        const packageName = extractPackageName(specifier);
        const uptoMatch = text.slice(0, match.index ?? 0);
        const line = uptoMatch.length === 0 ? 0 : uptoMatch.split('\n').length - 1;
        imports.push({ line, packageName });
    }
    return imports;
}
async function measurePackageSizeKb(packageName) {
    const cached = importSizeCache.get(packageName);
    if (cached !== undefined) {
        return cached;
    }
    try {
        const result = await (0, esbuild_1.build)({
            stdin: {
                contents: `import * as __import_size_ns from '${packageName}'; void __import_size_ns;`,
                loader: 'js',
                resolveDir: workspaceRoot,
            },
            bundle: true,
            write: false,
            minify: true,
            treeShaking: false,
            platform: 'browser',
            logLevel: 'silent',
        });
        const output = result.outputFiles?.[0];
        if (!output) {
            return null;
        }
        const gzippedBytes = (0, node_zlib_1.gzipSync)(output.contents).byteLength;
        const sizeKb = Number((gzippedBytes / 1024).toFixed(1));
        importSizeCache.set(packageName, sizeKb);
        return sizeKb;
    }
    catch {
        return null;
    }
}
async function computeInlayHintsForDocument(document) {
    const imports = collectPackageImports(document.getText());
    const hints = [];
    for (const entry of imports) {
        const sizeKb = await measurePackageSizeKb(entry.packageName);
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
