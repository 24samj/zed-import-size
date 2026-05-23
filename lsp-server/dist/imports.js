"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNpmPackage = isNpmPackage;
exports.extractPackageName = extractPackageName;
exports.collectPackageImports = collectPackageImports;
const SIDE_EFFECT_IMPORT_REGEX = /^\s*import\s*['"]([^'"]+)['"]\s*$/m;
const FROM_IMPORT_REGEX = /^\s*import(?:\s+type)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]\s*$/m;
function isNpmPackage(specifier) {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
        return false;
    }
    if (specifier.startsWith('@/') || specifier.startsWith('~/') || specifier.startsWith('#/')) {
        return false;
    }
    return true;
}
function extractPackageName(specifier) {
    if (specifier.startsWith('@')) {
        return specifier.split('/').slice(0, 2).join('/');
    }
    return specifier.split('/')[0];
}
function collectPackageImports(text) {
    const imports = [];
    const statements = text.split(';');
    let offset = 0;
    for (const statement of statements) {
        const trimmed = statement.trim();
        if (!trimmed.startsWith('import')) {
            offset += statement.length + 1;
            continue;
        }
        const sideEffectMatch = statement.match(SIDE_EFFECT_IMPORT_REGEX);
        const fromMatch = statement.match(FROM_IMPORT_REGEX);
        const specifier = sideEffectMatch?.[1] ?? fromMatch?.[1] ?? null;
        if (!specifier || !isNpmPackage(specifier)) {
            offset += statement.length + 1;
            continue;
        }
        const uptoStatement = text.slice(0, offset);
        const line = uptoStatement.length === 0 ? 0 : uptoStatement.split('\n').length;
        imports.push({
            line,
            packageName: extractPackageName(specifier),
            specifier,
        });
        offset += statement.length + 1;
    }
    return imports;
}
