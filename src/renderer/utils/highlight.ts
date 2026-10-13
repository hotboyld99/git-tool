import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import php from 'highlight.js/lib/languages/php'
import java from 'highlight.js/lib/languages/java'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import bash from 'highlight.js/lib/languages/bash'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import kotlin from 'highlight.js/lib/languages/kotlin'
import csharp from 'highlight.js/lib/languages/csharp'
import sql from 'highlight.js/lib/languages/sql'

const LANGUAGES = { typescript, javascript, python, php, java, json, yaml, markdown, css, xml, bash, go, rust, kotlin, csharp, sql }
for (const [name, lang] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, lang)

const BY_EXTENSION: Record<string, keyof typeof LANGUAGES> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  py: 'python', php: 'php', java: 'java', json: 'json', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', css: 'css', scss: 'css', html: 'xml', xml: 'xml', vue: 'xml', svg: 'xml',
  sh: 'bash', zsh: 'bash', go: 'go', rs: 'rust', kt: 'kotlin', cs: 'csharp', sql: 'sql'
}

export function languageOf(path: string): string | null {
  return BY_EXTENSION[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? null
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Returns escaped HTML for one line of code. */
export function highlightLine(code: string, language: string | null): string {
  if (!language || code.length > 2000) return escapeHtml(code)
  return hljs.highlight(code, { language, ignoreIllegals: true }).value
}
