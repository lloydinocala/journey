// ============================================================================
//  HELP ARTICLES — AGGREGATOR
//  The help content lives in one file per section (HelpArticles<Section>.js).
//  This file namespace-imports each section (so a missing/renamed export can
//  never hard-fail the build) and re-exports the combined HELP_ARTICLES array
//  and ROUTE_HELP map — the same public interface HelpDrawer has always used.
//  To edit help for a page, edit ONLY its section file. Keep article ids unique
//  across all section files (the dedupe below warns and drops repeats).
//  (Fleet help stays in HelpArticlesFleet.js, merged separately by HelpDrawer.)
// ============================================================================
import * as Overview from './HelpArticlesOverview'
import * as Dispatch from './HelpArticlesDispatch'
import * as Operations from './HelpArticlesOperations'
import * as Financials from './HelpArticlesFinancials'
import * as Maintenance from './HelpArticlesMaintenance'
import * as Permitting from './HelpArticlesPermitting'
import * as DataStation from './HelpArticlesDataStation'
import * as Admin from './HelpArticlesAdmin'
import * as Inventory from './HelpArticlesInventory'
import * as Tools from './HelpArticlesTools'
import * as Supplies from './HelpArticlesSupplies'

const SECTIONS = [Overview, Dispatch, Operations, Financials, Maintenance, Permitting, DataStation, Admin, Inventory, Tools, Supplies]
const arr = (m) => (m && Array.isArray(m.HELP_ARTICLES) ? m.HELP_ARTICLES : [])
const obj = (m) => (m && m.ROUTE_HELP && typeof m.ROUTE_HELP === 'object' ? m.ROUTE_HELP : {})

const _seen = new Set()
export const HELP_ARTICLES = SECTIONS.flatMap(arr).filter((a) => {
  if (!a || !a.id) return false
  if (_seen.has(a.id)) { if (typeof console !== 'undefined') console.warn('[help] duplicate article id skipped:', a.id); return false }
  _seen.add(a.id); return true
})

export const ROUTE_HELP = Object.assign({}, ...SECTIONS.map(obj))
