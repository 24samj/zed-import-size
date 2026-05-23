export interface PackageImport {
  cacheKey: string
  line: number
  measurementSource: string
  packageName: string
  specifier: string
}

const SIDE_EFFECT_IMPORT_REGEX = /^\s*import\s*['"]([^'"]+)['"]\s*$/m
const FROM_IMPORT_REGEX = /^\s*import(?:\s+type)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]\s*$/m
const IMPORT_CLAUSE_REGEX = /^\s*import\s+([\s\S]+?)\s+from\s+['"][^'"]+['"]\s*$/m
const IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/

export function isNpmPackage(specifier: string): boolean {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return false
  }

  if (specifier.startsWith('@/') || specifier.startsWith('~/') || specifier.startsWith('#/')) {
    return false
  }

  return true
}

export function extractPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    return specifier.split('/').slice(0, 2).join('/')
  }

  return specifier.split('/')[0]
}

function isTypeOnlyImport(statement: string): boolean {
  return /^import\s+type\b/.test(statement.trim())
}

function normalizeImportStatement(statement: string): string {
  const trimmed = statement.trim()
  return trimmed.endsWith(';') ? trimmed : `${trimmed};`
}

function extractImportClause(statement: string): string | null {
  return statement.match(IMPORT_CLAUSE_REGEX)?.[1]?.trim() ?? null
}

function isEmptyNamedImport(statement: string): boolean {
  return extractImportClause(statement)?.replace(/\s/g, '') === '{}'
}

function extractNamedBinding(specifier: string): string | null {
  const trimmed = specifier.trim()
  if (!trimmed || trimmed.startsWith('type ')) {
    return null
  }

  const aliasMatch = trimmed.match(/\bas\s+([A-Za-z_$][\w$]*)$/)
  if (aliasMatch) {
    return aliasMatch[1]
  }

  const nameMatch = trimmed.match(/^([A-Za-z_$][\w$]*)/)
  return nameMatch?.[1] ?? null
}

function extractRuntimeBindings(statement: string): string[] {
  const clause = extractImportClause(statement)
  if (!clause) {
    return []
  }

  const bindings: string[] = []
  const namespaceMatch = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/)
  if (namespaceMatch) {
    bindings.push(namespaceMatch[1])
  }

  const defaultMatch = clause.match(/^([A-Za-z_$][\w$]*)(?:\s*,|\s*$)/)
  if (defaultMatch) {
    bindings.push(defaultMatch[1])
  }

  const namedBlock = clause.match(/\{([\s\S]*)\}/)?.[1]
  if (namedBlock !== undefined) {
    for (const namedSpecifier of namedBlock.split(',')) {
      const binding = extractNamedBinding(namedSpecifier)
      if (binding) {
        bindings.push(binding)
      }
    }
  }

  return [...new Set(bindings)].filter((binding) => IDENTIFIER_REGEX.test(binding))
}

function createMeasurementSource(statement: string, isSideEffectImport: boolean): string | null {
  if (isTypeOnlyImport(statement)) {
    return null
  }

  const importStatement = normalizeImportStatement(statement)
  if (isSideEffectImport) {
    return importStatement
  }

  const bindings = extractRuntimeBindings(statement)
  if (bindings.length === 0) {
    if (isEmptyNamedImport(statement)) {
      return importStatement
    }

    return null
  }

  return [
    importStatement,
    `globalThis.__import_size_used = [${bindings.join(', ')}];`,
  ].join('\n')
}

export function collectPackageImports(text: string): PackageImport[] {
  const imports: PackageImport[] = []
  const statements = text.split(';')
  let offset = 0

  for (const statement of statements) {
    const trimmed = statement.trim()
    if (!trimmed.startsWith('import')) {
      offset += statement.length + 1
      continue
    }

    const sideEffectMatch = statement.match(SIDE_EFFECT_IMPORT_REGEX)
    const fromMatch = statement.match(FROM_IMPORT_REGEX)
    const specifier = sideEffectMatch?.[1] ?? fromMatch?.[1] ?? null
    if (!specifier || !isNpmPackage(specifier)) {
      offset += statement.length + 1
      continue
    }

    const measurementSource = createMeasurementSource(statement, sideEffectMatch !== null)
    if (!measurementSource) {
      offset += statement.length + 1
      continue
    }

    const specifierIndex = statement.indexOf(specifier)
    const hintOffset = specifierIndex === -1 ? offset : offset + specifierIndex
    const uptoHintLine = text.slice(0, hintOffset)
    const line = uptoHintLine.length === 0 ? 0 : uptoHintLine.split('\n').length - 1
    imports.push({
      cacheKey: `${extractPackageName(specifier)}|${measurementSource}`,
      line,
      measurementSource,
      packageName: extractPackageName(specifier),
      specifier,
    })
    offset += statement.length + 1
  }

  return imports
}
