import { build, BuildOptions, Loader, Platform, Plugin } from 'esbuild'
import flowRemoveTypes from 'flow-remove-types'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const assetLoaders = {
  '.gif': 'empty',
  '.jpeg': 'empty',
  '.jpg': 'empty',
  '.otf': 'empty',
  '.png': 'empty',
  '.svg': 'empty',
  '.ttf': 'empty',
  '.webp': 'empty',
} as const

const reactNativePeerExternals = ['react', 'react/*', 'react-native', 'react-native/*', 'expo', 'expo/*']

const reactNativeResolveOptions: Pick<
  BuildOptions,
  'conditions' | 'loader' | 'mainFields' | 'resolveExtensions' | 'plugins'
> = {
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
}

function externalPackagesFor(packageName: string): string[] {
  return reactNativePeerExternals.filter((externalPackage) => {
    const basePackage = externalPackage.endsWith('/*')
      ? externalPackage.slice(0, -2)
      : externalPackage

    return basePackage !== packageName
  })
}

function loaderForPath(filePath: string): Loader {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    return 'jsx'
  }

  return 'js'
}

function flowStripNodeModulesPlugin(): Plugin {
  return {
    name: 'flow-strip-node-modules',
    setup(pluginBuild): void {
      pluginBuild.onLoad({ filter: /\.[cm]?jsx?$/ }, async (args) => {
        if (!args.path.includes(`${path.sep}node_modules${path.sep}`)) {
          return undefined
        }

        const source = await readFile(args.path, 'utf8')
        const contents = flowRemoveTypes(source, { pretty: true }).toString()
        return {
          contents,
          loader: loaderForPath(args.path),
        }
      })
    },
  }
}

export interface MeasurePackageSizeOptions {
  packageName: string
  workspaceRoot: string
}

export async function measurePackageSizeKb({
  packageName,
  workspaceRoot,
}: MeasurePackageSizeOptions): Promise<number | null> {
  const buildAttempts: Array<{
    platform: Platform
    resolveOptions?: Pick<
      BuildOptions,
      'conditions' | 'external' | 'loader' | 'mainFields' | 'resolveExtensions' | 'plugins'
    >
  }> = [
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
  ]

  for (const attempt of buildAttempts) {
    try {
      const result = await build({
        stdin: {
          contents: `import * as __import_size_ns from '${packageName}'; void __import_size_ns;`,
          loader: 'js',
          resolveDir: workspaceRoot,
        },
        bundle: true,
        write: false,
        minify: true,
        treeShaking: false,
        platform: attempt.platform,
        logLevel: 'silent',
        ...attempt.resolveOptions,
      })

      const output = result.outputFiles?.[0]
      if (!output) {
        continue
      }

      return Number((gzipSync(output.contents).byteLength / 1024).toFixed(1))
    } catch {
      continue
    }
  }

  return null
}
