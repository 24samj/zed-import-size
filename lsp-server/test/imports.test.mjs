import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { collectPackageImports } from '../dist/imports.js'

function summarizeImports(imports) {
  return imports.map(({ line, packageName, specifier }) => ({ line, packageName, specifier }))
}

describe('collectPackageImports', () => {
  it('maps single-line imports to zero-based source lines', () => {
    const source = [
      '"use client";',
      'import "../global.css";',
      'import "react-native-reanimated";',
      'import "react-native-gesture-handler";',
      'import React, { useEffect } from "react";',
      'import { Stack } from "expo-router";',
    ].join('\n')

    assert.deepEqual(summarizeImports(collectPackageImports(source)), [
      { line: 2, packageName: 'react-native-reanimated', specifier: 'react-native-reanimated' },
      { line: 3, packageName: 'react-native-gesture-handler', specifier: 'react-native-gesture-handler' },
      { line: 4, packageName: 'react', specifier: 'react' },
      { line: 5, packageName: 'expo-router', specifier: 'expo-router' },
    ])
  })

  it('maps multiline imports to the line containing the package specifier', () => {
    const source = [
      'import {',
      '  SafeAreaProvider,',
      '  useSafeAreaInsets,',
      '} from "react-native-safe-area-context";',
    ].join('\n')

    assert.deepEqual(summarizeImports(collectPackageImports(source)), [
      {
        line: 3,
        packageName: 'react-native-safe-area-context',
        specifier: 'react-native-safe-area-context',
      },
    ])
  })

  it('skips relative and common alias imports', () => {
    const source = [
      'import { getPosthogNative } from "../utils/analytics.utils";',
      'import { useThing } from "@/hooks/useThing";',
      'import stuff from "~/lib/stuff";',
      'import config from "#/config";',
      'import React from "react";',
    ].join('\n')

    assert.deepEqual(summarizeImports(collectPackageImports(source)), [
      { line: 4, packageName: 'react', specifier: 'react' },
    ])
  })

  it('creates measurement sources from the actual import shape', () => {
    const source = [
      'import * as DevMenu from "expo-dev-client";',
      'import React, { useEffect } from "react";',
      'import {',
      '  SafeAreaProvider,',
      '  useSafeAreaInsets,',
      '} from "react-native-safe-area-context";',
      'import "react-native-reanimated";',
    ].join('\n')

    const imports = collectPackageImports(source)

    assert.deepEqual(
      imports.map(({ line, packageName, specifier, measurementSource, cacheKey }) => ({
        line,
        packageName,
        specifier,
        measurementSource,
        cacheKey,
      })),
      [
        {
          line: 0,
          packageName: 'expo-dev-client',
          specifier: 'expo-dev-client',
          measurementSource:
            'import * as DevMenu from "expo-dev-client";\nglobalThis.__import_size_used = [DevMenu];',
          cacheKey:
            'expo-dev-client|import * as DevMenu from "expo-dev-client";\nglobalThis.__import_size_used = [DevMenu];',
        },
        {
          line: 1,
          packageName: 'react',
          specifier: 'react',
          measurementSource:
            'import React, { useEffect } from "react";\nglobalThis.__import_size_used = [React, useEffect];',
          cacheKey:
            'react|import React, { useEffect } from "react";\nglobalThis.__import_size_used = [React, useEffect];',
        },
        {
          line: 5,
          packageName: 'react-native-safe-area-context',
          specifier: 'react-native-safe-area-context',
          measurementSource:
            'import {\n  SafeAreaProvider,\n  useSafeAreaInsets,\n} from "react-native-safe-area-context";\nglobalThis.__import_size_used = [SafeAreaProvider, useSafeAreaInsets];',
          cacheKey:
            'react-native-safe-area-context|import {\n  SafeAreaProvider,\n  useSafeAreaInsets,\n} from "react-native-safe-area-context";\nglobalThis.__import_size_used = [SafeAreaProvider, useSafeAreaInsets];',
        },
        {
          line: 6,
          packageName: 'react-native-reanimated',
          specifier: 'react-native-reanimated',
          measurementSource: 'import "react-native-reanimated";',
          cacheKey: 'react-native-reanimated|import "react-native-reanimated";',
        },
      ],
    )
  })

  it('skips type-only imports and does not retain type-only named bindings', () => {
    const source = [
      'import type { ReactNode } from "react";',
      'import { type ReactElement, useMemo as useReactMemo } from "react";',
    ].join('\n')

    const imports = collectPackageImports(source)

    assert.deepEqual(
      imports.map(({ line, packageName, specifier, measurementSource }) => ({
        line,
        packageName,
        specifier,
        measurementSource,
      })),
      [
        {
          line: 1,
          packageName: 'react',
          specifier: 'react',
          measurementSource:
            'import { type ReactElement, useMemo as useReactMemo } from "react";\nglobalThis.__import_size_used = [useReactMemo];',
        },
      ],
    )
  })

  it('keeps empty named imports because they still run the module', () => {
    const source = 'import {} from "side-effectful-package";'

    const imports = collectPackageImports(source)

    assert.deepEqual(
      imports.map(({ line, packageName, specifier, measurementSource }) => ({
        line,
        packageName,
        specifier,
        measurementSource,
      })),
      [
        {
          line: 0,
          packageName: 'side-effectful-package',
          specifier: 'side-effectful-package',
          measurementSource: 'import {} from "side-effectful-package";',
        },
      ],
    )
  })
})
