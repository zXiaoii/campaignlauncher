// Importing what already runs in Meta. Charles pastes ad-set names one per line,
// exactly as they appear; this turns each line into the record the seed would
// have produced for it, so imported and seeded CBOs are indistinguishable.
//
// The date at the front of the name (MM/DD/YY, the §1.4 convention) becomes the
// launch date at noon local time; the words after it decide the framework, which
// is what Next batch models the next launch on.

import { CONCEPT_LABELS } from './naming'
import type { ConceptType } from './types'

export interface ParsedAdset {
  /** Exactly as typed, trimmed. */
  name: string
  /** ISO timestamp when the name starts with a date; unset otherwise. */
  launchedAt?: string
  conceptType: ConceptType
  conceptLabel: string
  /** Why this line will be refused, when it will. */
  problem?: string
}

/**
 * Name of the stand-in ad set a CBO gets when its real ad sets are not known yet.
 * Reads as a status on purpose — it is not a name anyone should copy into Meta.
 */
export const PLACEHOLDER_ADSET_NAME = 'ad sets not imported yet'

/** Older databases used "existing ads" for the same stand-in. */
const LEGACY_PLACEHOLDER_NAMES = new Set([PLACEHOLDER_ADSET_NAME, 'existing ads'])

/** The stand-in row, as opposed to an ad set that really runs in Meta. */
export function isPlaceholderAdset(a: { name: string; launchedAt?: string }): boolean {
  return !a.launchedAt && LEGACY_PLACEHOLDER_NAMES.has(a.name)
}

const DATE_PREFIX = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b\s*/

export function parseAdsetLine(raw: string): ParsedAdset | null {
  const name = raw.trim()
  if (!name) return null

  let launchedAt: string | undefined
  let rest = name
  const m = name.match(DATE_PREFIX)
  if (m) {
    const month = Number(m[1])
    const day = Number(m[2])
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    const d = new Date(year, month - 1, day, 12, 0, 0, 0)
    // Reject 13/40/26 and friends: the Date object silently rolls over.
    if (d.getMonth() === month - 1 && d.getDate() === day) {
      launchedAt = d.toISOString()
      rest = name.slice(m[0].length)
    }
  }

  const words = rest.toLowerCase()
  const conceptType: ConceptType = words.includes('deep')
    ? 'DEEP_ITERATION'
    : words.includes('iter')
      ? 'ITERATION'
      : words.includes('variat')
        ? 'VARIATION'
        : words.includes('pure')
          ? 'SWIPES'
          : // Plain "swipes" in a name has always meant the team's default, Swipes + Playbook.
            words.includes('swipe') || rest.trim() === ''
            ? 'SWIPES_PLAYBOOK'
            : 'CUSTOM'
  const conceptLabel = conceptType === 'CUSTOM' ? rest.trim() || name : CONCEPT_LABELS[conceptType]

  return { name, launchedAt, conceptType, conceptLabel }
}

// ---------------------------------------------------------------------------
// Meta Ads Manager export. "Export table data" from the ad-set level gives a CSV
// (or the table copied straight from the page, which is tab-separated) with at
// least "Campaign name" and "Ad set name" columns. Column order and casing vary
// by account and language setting, so headers are matched loosely.

export interface MetaExportRow {
  campaign: string
  adset: string
  /** Meta's delivery status, when the export has the column ("active", "adset_off"…). */
  delivery?: string
  /** Ad account name, when the export spans accounts. */
  account?: string
}

export interface MetaExport {
  rows: MetaExportRow[]
  /** Header text the columns were found under — shown so Charles can see the match. */
  columns: { campaign: string; adset: string; delivery?: string; account?: string }
  /** Distinct account names in the file, when it has that column. */
  accounts: string[]
}

/** Minimal CSV/TSV reader: quoted fields, doubled quotes, CRLF, BOM. */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') && !firstLine.includes(',') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[_\s]+/g, ' ')

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(norm(h)))
    if (i >= 0) return i
  }
  return -1
}

/** Throws with a plain-English reason when the required columns are missing. */
export function parseMetaExport(text: string): MetaExport {
  return metaExportFromTable(parseDelimited(text))
}

// ---------------------------------------------------------------------------
// .xlsx without a library. A workbook is a zip of XML files; the browser can
// inflate zip entries natively (DecompressionStream) and parse XML (DOMParser),
// so the two files we need — the shared-string table and the first worksheet —
// come out in ~80 lines. Enough for a Meta export; not a general spreadsheet reader.

async function inflateEntry(bytes: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === 0) return bytes
  if (method !== 8) throw new Error('This workbook uses a compression the browser cannot read. Export as CSV instead.')
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot read .xlsx files. Export as CSV instead, or use Chrome / Edge.')
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Every entry in the zip, by path, inflated lazily. */
function zipEntries(buf: ArrayBuffer): Map<string, () => Promise<Uint8Array>> {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  // End-of-central-directory record: scan back for its signature.
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('That file is not a .xlsx workbook.')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const utf8 = new TextDecoder()
  const entries = new Map<string, () => Promise<Uint8Array>>()
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break
    const method = view.getUint16(p + 10, true)
    const compressedSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    entries.set(name, async () => {
      const localNameLen = view.getUint16(localOffset + 26, true)
      const localExtraLen = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + localNameLen + localExtraLen
      return inflateEntry(bytes.subarray(start, start + compressedSize), method)
    })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** The first worksheet of a .xlsx as rows of strings, shared strings resolved. */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const entries = zipEntries(buf)
  const utf8 = new TextDecoder()
  const xml = async (path: string) => {
    const get = entries.get(path)
    if (!get) return null
    return new DOMParser().parseFromString(utf8.decode(await get()), 'application/xml')
  }

  const strings: string[] = []
  const sst = await xml('xl/sharedStrings.xml')
  if (sst) {
    for (const si of Array.from(sst.getElementsByTagName('si'))) {
      strings.push(Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''))
    }
  }

  const sheetPath =
    [...entries.keys()]
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0] ?? ''
  const sheet = await xml(sheetPath)
  if (!sheet) throw new Error('The workbook has no worksheet.')

  const rows: string[][] = []
  for (const row of Array.from(sheet.getElementsByTagName('row'))) {
    const out: string[] = []
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const idx = columnIndex(c.getAttribute('r') ?? '')
      const type = c.getAttribute('t')
      let value = ''
      if (type === 's') {
        value = strings[Number(c.getElementsByTagName('v')[0]?.textContent ?? -1)] ?? ''
      } else if (type === 'inlineStr') {
        value = Array.from(c.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('')
      } else {
        value = c.getElementsByTagName('v')[0]?.textContent ?? ''
      }
      while (out.length < idx) out.push('')
      out[idx] = value
    }
    rows.push(out)
  }
  return rows.filter((r) => r.some((v) => v.trim()))
}

/** Whitespace-insensitive, case-insensitive name comparison — Meta pads some names. */
const squash = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * The ad account an export row belongs to: the exact display name first, then the
 * leading "#nnnn" / "nnnnn" number, which survives every supplier's re-labelling.
 */
export function matchAccount<T extends { displayName: string; adAccountNumber: string }>(
  accountName: string | undefined,
  accounts: T[],
): T | undefined {
  if (!accountName) return undefined
  const wanted = squash(accountName)
  const exact = accounts.find((a) => squash(a.displayName) === wanted)
  if (exact) return exact
  const num = accountName.trim().match(/^#?\s*(\d+)/)?.[1]
  return num ? accounts.find((a) => a.adAccountNumber === num) : undefined
}

/**
 * Best guess at where a brand-new account belongs, from how suppliers name them:
 * "#7966 - UK | AD 17 - Danny - ADSC" carries the market and the supplier;
 * "50643 reliore [GO DGTL]" carries the store, which an existing account of the
 * same store pins to a market.
 */
export function guessAccountDetails<
  C extends { id: string; code: string; name: string },
  A extends { countryId: string; store?: string; supplier?: string },
>(displayName: string, countries: C[], existing: A[]): { countryId?: string; supplier?: string; store?: string } {
  const name = displayName.trim()
  const upper = name.toUpperCase()
  const supplier = upper.includes('GO DGTL')
    ? 'GO DGTL'
    : /\bADSC\b/.test(upper)
      ? 'ADSC'
      : /\bRHKA\b/.test(upper)
        ? 'RHKA'
        : undefined

  // "… - AUS | AD 3 - …" — the market label the ADSC/RHKA panels use.
  const marketLabel = name.match(/-\s*([A-Za-z ]+?)\s*\|/)?.[1]?.trim().toUpperCase()
  const byLabel = marketLabel
    ? countries.find(
        (c) =>
          c.code.toUpperCase() === marketLabel ||
          c.name.toUpperCase() === marketLabel ||
          (marketLabel === 'AUS' && c.code.toUpperCase() === 'AUSTRALIA') ||
          (marketLabel === 'AUS' && c.name.toUpperCase() === 'AUSTRALIA'),
      )
    : undefined

  // "50643 reliore [GO DGTL]" — the store word before the bracket.
  const storeWord = name.match(/^\d+\s+([A-Za-z]+)/)?.[1]
  const sameStore = storeWord
    ? existing.find((a) => a.store && a.store.toLowerCase() === storeWord.toLowerCase())
    : undefined

  return {
    countryId: byLabel?.id ?? sameStore?.countryId,
    supplier,
    store: sameStore?.store ?? (supplier === 'GO DGTL' && storeWord ? storeWord[0].toUpperCase() + storeWord.slice(1) : undefined),
  }
}

/**
 * A supplier panel pasted as text — one account per block: the display name, then
 * an ID line, a create date, a status, a balance and an IANA timezone. Only the
 * name is needed; the timezone rides along when it follows the name.
 */
export interface PastedAccount {
  displayName: string
  timezone?: string
}

export function parseAccountList(text: string): PastedAccount[] {
  const out: PastedAccount[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (/^#?\d+\s*-\s*\S/.test(line) || /^\d{4,}\s+\S+.*\[GO DGTL\]/i.test(line)) {
      out.push({ displayName: line })
    } else if (/^[A-Z][A-Za-z_]+\/[A-Za-z_]+$/.test(line) && out.length) {
      out[out.length - 1].timezone = out[out.length - 1].timezone ?? line
    }
  }
  return out
}

/** Throws with a plain-English reason when the required columns are missing. */
export function metaExportFromTable(table: string[][]): MetaExport {
  if (table.length < 2) throw new Error('Nothing to read — paste the table or choose the exported file.')
  const headers = table[0]
  const campaignCol = findColumn(headers, [/^campaign name$/, /^campaign$/])
  const adsetCol = findColumn(headers, [/^ad set name$/, /^adset name$/, /^ad set$/])
  if (campaignCol < 0 || adsetCol < 0) {
    throw new Error(
      `Could not find the "Campaign name" and "Ad set name" columns. Export from the Ad sets tab in Ads Manager. Headers seen: ${headers
        .slice(0, 8)
        .map((h) => `"${h.trim()}"`)
        .join(', ')}${headers.length > 8 ? '…' : ''}`,
    )
  }
  const deliveryCol = findColumn(headers, [/^ad set delivery$/, /^delivery status$/, /^delivery$/, /delivery/])
  const accountCol = findColumn(headers, [/^ad account name$/, /^account name$/, /^ad account$/])

  const seen = new Set<string>()
  const rows: MetaExportRow[] = []
  for (const r of table.slice(1)) {
    const campaign = (r[campaignCol] ?? '').trim()
    const adset = (r[adsetCol] ?? '').trim()
    if (!campaign || !adset) continue
    const key = `${campaign} ${adset}`
    if (seen.has(key)) continue // ad-level exports repeat the ad set once per ad
    seen.add(key)
    rows.push({
      campaign,
      adset,
      delivery: deliveryCol >= 0 ? (r[deliveryCol] ?? '').trim() || undefined : undefined,
      account: accountCol >= 0 ? (r[accountCol] ?? '').trim() || undefined : undefined,
    })
  }
  if (rows.length === 0) throw new Error('The file has the right columns but no ad-set rows.')
  return {
    rows,
    columns: {
      campaign: headers[campaignCol].trim(),
      adset: headers[adsetCol].trim(),
      delivery: deliveryCol >= 0 ? headers[deliveryCol].trim() : undefined,
      account: accountCol >= 0 ? headers[accountCol].trim() : undefined,
    },
    accounts: [...new Set(rows.map((r) => r.account).filter((a): a is string => Boolean(a)))],
  }
}

/** Meta delivery values that mean the ad set is not running. */
export function isDeliveryOff(delivery: string | undefined): boolean {
  if (!delivery) return false
  return /off|inactive|not.?deliver|archived|deleted|completed|rejected|disapproved|paused/i.test(delivery)
}

/**
 * Best-guess product for a campaign name: the longest known product name that
 * appears in it ("MAIN CBO Revida 4" → Revida). Undefined when none matches.
 */
export function guessProduct<T extends { name: string }>(campaignName: string, products: T[]): T | undefined {
  const hay = campaignName.toLowerCase()
  return [...products]
    .sort((a, b) => b.name.length - a.name.length)
    .find((p) => p.name.trim() && hay.includes(p.name.trim().toLowerCase()))
}

/**
 * All lines of a paste, in order, with duplicates flagged. Empty lines are dropped.
 * `existingNames` are ad sets already in the destination CBO.
 */
export function parseAdsetLines(text: string, existingNames: string[] = []): ParsedAdset[] {
  const seen = new Set(existingNames)
  const out: ParsedAdset[] = []
  for (const raw of text.split('\n')) {
    const parsed = parseAdsetLine(raw)
    if (!parsed) continue
    if (seen.has(parsed.name)) {
      parsed.problem = existingNames.includes(parsed.name)
        ? 'Already in this CBO.'
        : 'Typed twice.'
    }
    seen.add(parsed.name)
    out.push(parsed)
  }
  return out
}
