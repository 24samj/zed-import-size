import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { collectPackageImports } from '../dist/imports.js'

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

    assert.deepEqual(collectPackageImports(source), [
      { line: 2, packageName: 'react-native-reanimated', specifier: 'react-native-reanimated' },
      { line: 3, packageName: 'react-native-gesture-handler', specifier: 'react-native-gesture-handler' },
      { line: 4, packageName: 'react', specifier: 'react' },
      { line: 5, packageName: 'expo-router', specifier: 'expo-router' },
    ])
  })

  it('maps multiline imports to the first import line', () => {
    const source = [
      'import {',
      '  SafeAreaProvider,',
      '  useSafeAreaInsets,',
      '} from "react-native-safe-area-context";',
    ].join('\n')

    assert.deepEqual(collectPackageImports(source), [
      {
        line: 0,
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

    assert.deepEqual(collectPackageImports(source), [
      { line: 4, packageName: 'react', specifier: 'react' },
    ])
  })
})
