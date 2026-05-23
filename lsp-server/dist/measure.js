"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.measurePackageSizeKb = measurePackageSizeKb;
const esbuild_1 = require("esbuild");
const flow_remove_types_1 = __importDefault(require("flow-remove-types"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_zlib_1 = require("node:zlib");
const assetLoaders = {
    '.gif': 'empty',
    '.jpeg': 'empty',
    '.jpg': 'empty',
    '.otf': 'empty',
    '.png': 'empty',
    '.svg': 'empty',
    '.ttf': 'empty',
    '.webp': 'empty',
};
const reactNativePeerExternals = ['react', 'react/*', 'react-native', 'react-native/*', 'expo', 'expo/*'];
const reactNativeResolveOptions = {
    conditions: ['react-native', 'browser', 'import', 'default'],
    loader: assetLoaders,
    mainFields: ['react-native', 'browser', 'module', 'main'],
    resolveExtensions: [
        '.web.tsx',
        '.web.ts',
        '.web.jsx',
        '.web.js',
        '.native.tsx',
        '.native.ts',
        '.native.jsx',
        '.native.js',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.json',
    ],
    plugins: [flowStripNodeModulesPlugin()],
};
function externalPackagesFor(packageName) {
    return reactNativePeerExternals.filter((externalPackage) => {
        const basePackage = externalPackage.endsWith('/*')
            ? externalPackage.slice(0, -2)
            : externalPackage;
        return basePackage !== packageName;
    });
}
function loaderForPath(filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
        return 'jsx';
    }
    return 'js';
}
function flowStripNodeModulesPlugin() {
    return {
        name: 'flow-strip-node-modules',
        setup(pluginBuild) {
            pluginBuild.onLoad({ filter: /\.[cm]?jsx?$/ }, async (args) => {
                if (!args.path.includes(`${node_path_1.default.sep}node_modules${node_path_1.default.sep}`)) {
                    return undefined;
                }
                const source = await (0, promises_1.readFile)(args.path, 'utf8');
                const contents = (0, flow_remove_types_1.default)(source, { pretty: true }).toString();
                return {
                    contents,
                    loader: loaderForPath(args.path),
                };
            });
        },
    };
}
async function measurePackageSizeKb({ measurementSource, packageName, workspaceRoot, }) {
    const buildAttempts = [
        { platform: 'browser' },
        { platform: 'neutral' },
        {
            platform: 'browser',
            resolveOptions: { ...reactNativeResolveOptions, external: externalPackagesFor(packageName) },
        },
        {
            platform: 'neutral',
            resolveOptions: { ...reactNativeResolveOptions, external: externalPackagesFor(packageName) },
        },
    ];
    for (const attempt of buildAttempts) {
        try {
            const result = await (0, esbuild_1.build)({
                stdin: {
                    contents: measurementSource,
                    loader: 'tsx',
                    resolveDir: workspaceRoot,
                },
                bundle: true,
                write: false,
                minify: true,
                treeShaking: true,
                platform: attempt.platform,
                logLevel: 'silent',
                ...attempt.resolveOptions,
            });
            const output = result.outputFiles?.[0];
            if (!output) {
                continue;
            }
            return Number(((0, node_zlib_1.gzipSync)(output.contents).byteLength / 1024).toFixed(1));
        }
        catch {
            continue;
        }
    }
    return null;
}
