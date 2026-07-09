// Provide JSDOM in the global scope for the node-side getPurify (utils.js),
// before any source module is evaluated. Loaded via .mocharc `file`, so it runs
// before the spec files (and thus before schema.js builds SCHEMA at load time).
import { JSDOM } from 'jsdom'
global.JSDOM = JSDOM
