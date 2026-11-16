// parse.js — a dependency-free, faster drop-in for marked 18.1.3's `marked.parse`.
//
// parse(markdown) returns, for every string, exactly the HTML marked 18.1.3 renders with its default
// options (gfm true, breaks false, pedantic false, async false).
//
// This file is a fork of marked 18.1.3 (https://github.com/markedjs/marked, MIT: see
// vendor/marked/LICENSE and vendor/marked/NOTICE), reduced to the default GFM path and then made
// faster without changing what it computes. See README.md for the list of changes.
//
// Nothing is kept from one call to the next: every call builds a new Lexer, and the module-level
// values are regexes and character tables that depend on no input.

// ---------------------------------------------------------------------------------------------
// marked 18.1.3's block and inline rules for GFM, as marked builds them (generated from the vendored
// build, sources unchanged).
const b_blockquote = /^( {0,3}> ?(?:(?![ \t]*(?:\n|$))(([^\n]+(?:\n(?! {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)|[ \t]+\n)[^\n]+)*))|[^\n]*)(?:\n|$))+/;
const b_code = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
const b_def = /^ {0,3}\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)((?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))))? *(?:\n+|$)/;
const b_fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/;
const b_heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
const b_hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
const b_html = /^ {0,3}(?:<(script|pre|style|textarea)[\s>][\s\S]*?(?:<\/\1>[^\n]*\n*|$)|<!--(?:-?>|[\s\S]*?(?:-->|$))[^\n]*(\n+|$)|<\?[\s\S]*?(?:\?>[^\n]*\n*|$)|<![A-Z][\s\S]*?(?:>[^\n]*\n*|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>[^\n]*\n*|$)|<\/?(address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t]+|\n|\/?>|$)[\s\S]*?(?:(?:\n[ 	]*)+\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?: +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?)*? *\/?>(?=[ \t]*(?:\n|$))[\s\S]*?(?:(?:\n[ 	]*)+\n|$)|<\/[a-z][a-z0-9-]*\s*>(?=[ \t]*(?:\n|$))[\s\S]*?(?:(?:\n[ 	]*)+\n|$))/i;
const b_lheading = /^(?! {0,3}(?:[*+-]|\d{1,9}[.)]) |(?: {4}| {0,3}\t)| {0,3}(?:`{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\s|$)| {0,3}<[^\n>]+>\n| {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n)((?:.|\n(?!\s*?\n| {0,3}(?:[*+-]|\d{1,9}[.)]) | {0,3}(?:`{3,}|~{3,})| {0,3}>| {0,3}#{1,6}(?:\s|$)| {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}<[^\n>]+>\n| {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/;
const b_list = /^( {0,3}(?:[*+-]|\d{1,9}[.)]))([ \t][^\n]*?)?(?:\n|$)/;
const b_newline = /^(?:[ \t]*(?:\n|$))+/;
const b_paragraph = /^([^\n]+(?:\n(?! {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)| *([^\n ].*)\n {0,3}((?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?)(?:\n((?:(?! *\n| {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>|(?: {4}| {0,3}	)[^\n]| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|1[.)])[ \t]| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)).*(?:\n|$))*)\n*|$)|[ \t]+\n)[^\n]+)*)/;
const b_table = /^ *([^\n ].*)\n {0,3}((?:\| *)?:?-+:? *(?:\| *:?-+:? *)*(?:\| *)?)(?:\n((?:(?! *\n| {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)| {0,3}#{1,6}(?:\s|$)| {0,3}>|(?: {4}| {0,3}	)[^\n]| {0,3}(?:`{3,}(?=[^`\n]*(?:\n|$))|~~~)[^\n]*(?:\n|$)| {0,3}(?:[*+-]|1[.)])[ \t]| {0,3}(?:<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?: +|\n|\/?>)|<(?:(?:script|pre|style|textarea)(?:[\s>]|$)|!--)|<\?|<![A-Za-z]|<!\[CDATA\[)).*(?:\n|$))*)\n*|$)/;
const i__backpedal = /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/;
const i_anyPunctuation = /\\([\p{P}\p{S}])/gu;
const i_anyPunctuationOutsideCode = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\([\p{P}\p{S}])/gu;
const i_autolink = /^<([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\s\x00-\x1f<>]*|[a-zA-Z0-9.!#$%&'*+/=?_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_]))>/;
const i_blockSkip = /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)|(?<!`)()(?<b>`+)[^`]+\k<b>(?!`)|<(?! )[^<>]*?>/g;
const i_br = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
const i_code = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const i_delLDelim = /^~~?(?:((?!~)[\p{P}\p{S}])|[^\s~])/u;
const i_delRDelim = /^[^~]+(?=[^~])|(?!~)[\p{P}\p{S}](~~?)(?=[\s]|$)|[^\s\p{P}\p{S}](~~?)(?!~)(?=[\s\p{P}\p{S}]|$)|(?!~)[\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])|[\s](~~?)(?!~)(?=[\p{P}\p{S}])|(?!~)[\p{P}\p{S}](~~?)(?!~)(?=[\p{P}\p{S}])|[^\s\p{P}\p{S}](~~?)(?=[^\s\p{P}\p{S}])/gu;
const i_emStrongLDelim = /^(?:\*+(?:((?!\*)(?!~)[\p{P}\p{S}])|([^\s*]))?)|^_+(?:((?!_)(?!~)[\p{P}\p{S}])|([^\s_]))?/u;
const i_emStrongRDelimAst = /^[^_*]*?__[^_*]*?\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?=[\s]|$)|(?:[^\s\p{P}\p{S}]|~)(\*+)(?!\*)(?=(?!~)[\s\p{P}\p{S}]|$)|(?!\*)(?!~)[\s\p{P}\p{S}](\*+)(?=(?:[^\s\p{P}\p{S}]|~))|[\s](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?!\*)(?!~)[\p{P}\p{S}](\*+)(?!\*)(?=(?!~)[\p{P}\p{S}])|(?:[^\s\p{P}\p{S}]|~)(\*+)(?=(?:[^\s\p{P}\p{S}]|~))/gu;
const i_emStrongRDelimUnd = /^[^_*]*?\*\*[^_*]*?_[^_*]*?(?=\*\*)|[^_]+(?=[^_])|(?!_)[\p{P}\p{S}](_+)(?=[\s]|$)|[^\s\p{P}\p{S}](_+)(?!_)(?=[\s\p{P}\p{S}]|$)|(?!_)[\s\p{P}\p{S}](_+)(?=[^\s\p{P}\p{S}])|[\s](_+)(?!_)(?=[\p{P}\p{S}])|(?!_)[\p{P}\p{S}](_+)(?!_)(?=[\p{P}\p{S}])/gu;
const i_escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
const i_link = /^!?\[((?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?)\]\([ \t\n]*(<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\)))(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)))?[ \t\n]*\)/;
const i_nolink = /^!?\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\](?:\[\])?/;
const i_punctuation = /^((?![*_])[\s\p{P}\p{S}])/u;
const i_reflink = /^!?\[((?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?)\]\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+)\]/;
const i_reflinkSearch = /!?\[((?:[^\[\]\\`]*(?:\[(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?)\]\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\]|!?\[((?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999})\](?:\[\])?(?!\()/g;
const i_tag = /^<!--(?:-?>|[\s\S]*?-->)|^<\/[a-zA-Z][a-zA-Z0-9-]*\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?)*?\s*\/?>|^<\?[\s\S]*?\?>|^<![a-zA-Z]+\s[\s\S]*?>|^<!\[CDATA\[[\s\S]*?\]\]>/;
const i_url = /^(?:mailto:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])|xmpp:[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])(?:\/[A-Za-z0-9@.]+)?)|^((?:[hH][tT][tT][pP][sS]?|[fF][tT][pP]):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/;

// ---------------------------------------------------------------------------------------------
// "other" rules (marked's `other` table), unchanged.
const o_codeRemoveIndent = /^(?: {0,3}\t| {1,4})/gm;
const o_outputLinkReplace = /\\([\[\]])/g;
const o_indentCodeCompensation = /^(\s+)(?:```)/;
const o_beginningSpace = /^\s+/;
const o_endingHash = /#$/;
const o_endingSpaceTabChar = /[ \t]$/;
const o_nonSpaceChar = /[^ ]/;
const o_newLineCharGlobal = /\n/g;
const o_tabCharGlobal = /\t/g;
const o_leadingSpaceTab = /^[ \t]+/;
const o_multipleSpaceGlobal = /\s+/g;
const o_blankLine = /^[ \t]*$/;
const o_blockquoteStart = /^ {0,3}>/;
const o_blockquoteSetextReplace = /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g;
const o_blockquoteSetextReplace2 = /^ {0,3}>[ \t]?/gm;
const o_blockquoteMarkerWhitespace = /^( {0,3}>)([ \t]+)/gm;
const o_listIsTask = /^\[[ xX]\][ \t]+\S/;
const o_listReplaceTask = /^\[[ xX]\][ \t]+/;
const o_listTaskCheckbox = /\[[ xX]\]/;
const o_anyLine = /\n.*\n/;
const o_hrefBrackets = /^<(.*)>$/;
const o_tableDelimiter = /[:|]/;
const o_tableAlignChars = /^\||\| *$/g;
const o_tableRowBlankLine = /\n[ \t]*$/;
const o_tableAlignRight = /^ *-+: *$/;
const o_tableAlignCenter = /^ *:-+: *$/;
const o_tableAlignLeft = /^ *:-+ *$/;
const o_startATag = /^<a /i;
const o_endATag = /^<\/a>/i;
const o_startPreScriptTag = /^<(pre|code|kbd|script)(\s|>)/i;
const o_endPreScriptTag = /^<\/(pre|code|kbd|script)(\s|>)/i;
const o_unicodeAlphaNumeric = /[\p{L}\p{N}]/u;
const o_numericCharacterReference = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/;
const o_numericCharacterReferenceOrAmpersand = /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;
const o_escapeTest = /[&<>"']/;
const o_escapeReplace = /[&<>"']/g;
const o_escapeTestNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
const o_escapeReplaceNoEncode = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;
const o_percentDecode = /%25/g;
const o_findPipe = /\|/g;
const o_splitPipe = / \|/;
const o_slashPipe = /\\\|/g;
const o_carriageReturn = /\r\n|\r/g;
const o_notSpaceStart = /^\S*/;
const o_endingNewline = /\n$/;
const o_listSetext = /^ {0,3}(?:=+|-+) *$/;
const o_listSetextIndent = /^ {0,3}/;
const o_leadingNewline = /^\n/;
const o_backtickGlobal = /`/g;

// The per-list-item regexes. marked builds the item regex once per list from the list's bullet and
// keeps the other five in a four-slot table indexed by the item's indent; here all of them are built
// once, when the module loads (they depend on nothing but the bullet character or the slot).
const HTML_TAGS =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';
const listItemRegexOf = (bull) => new RegExp(`^( {0,3}${bull})((?:[\t ][^\\n]*)?(?:\\n|$))`);
const LI_STAR = listItemRegexOf('\\*');
const LI_PLUS = listItemRegexOf('\\+');
const LI_DASH = listItemRegexOf('\\-');
const LI_DOT = listItemRegexOf('\\d{1,9}\\.');
const LI_PAREN = listItemRegexOf('\\d{1,9}\\)');
const slots = (make) => [make(0), make(1), make(2), make(3)];
const NEXT_BULLET = slots((a) => new RegExp(`^ {0,${a}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`));
const HR_BEGIN = slots((a) => new RegExp(`^ {0,${a}}((?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\\*[ \t]*){3,})(?:\\n+|$)`));
const FENCES_BEGIN = slots((a) => new RegExp(`^ {0,${a}}(?:\`\`\`|~~~)`));
const HEADING_BEGIN = slots((a) => new RegExp(`^ {0,${a}}#{1,6}(?:\\s|$)`));
const HTML_BEGIN = slots(
  (a) => new RegExp(`^ {0,${a}}(?:</?(?:${HTML_TAGS})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, 'i'),
);
const BLOCKQUOTE_BEGIN = slots((a) => new RegExp(`^ {0,${a}}>`));

// The paragraph rule is ^([^\n]+(?:\n(?!STOP)[^\n]+)*) : STOP, the alternation that ends a paragraph at
// a line start, is cut out of marked's own regex and compiled sticky, so paragraphEnd() below can ask
// it at one line start at a time.
const PARA_HEAD = '^([^\\n]+(?:\\n(?!';
const PARA_TAIL = ')[^\\n]+)*)';
const paraSource = b_paragraph.source;
if (!paraSource.startsWith(PARA_HEAD) || !paraSource.endsWith(PARA_TAIL)) throw new Error('unexpected paragraph rule');
const PARA_STOP = new RegExp(paraSource.slice(PARA_HEAD.length, paraSource.length - PARA_TAIL.length), 'y');

// ---------------------------------------------------------------------------------------------
// Character tables (ASCII; every other code unit is handled by the comment at its use).
const T_STOP = 1; // [\\<!\[`*~_] : inline text always ends before one
const T_NONALNUM = 2; // [^a-zA-Z0-9]
const T_NONEMAIL = 4; // [^a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-]
const T_HFW = 8; // h H f F w : a protocol or www. may start here
const T_SPACE = 16; // the space character
const T_URLMAIL = 32; // [A-Za-z0-9._+-] : the characters an extended e-mail autolink starts with
const T_PARA = 64; // a line starting with one may end a paragraph on its own:  \t - _ * # > ` ~ + 1 <
const T_LIST = 128; // a line whose first non-space is one may end a list item: ` ~ # < > * + - _ 0-9
const CT = new Uint8Array(128);
for (let i = 0; i < 128; i++) {
  const ch = String.fromCharCode(i);
  let f = 0;
  if ('\\<![`*~_'.includes(ch)) f |= T_STOP;
  if (!/[a-zA-Z0-9]/.test(ch)) f |= T_NONALNUM;
  if (!/[a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-]/.test(ch)) f |= T_NONEMAIL;
  if ('hHfFw'.includes(ch)) f |= T_HFW;
  if (ch === ' ') f |= T_SPACE;
  if (/[A-Za-z0-9._+-]/.test(ch)) f |= T_URLMAIL;
  if (' \t-_*#>`~+1<'.includes(ch)) f |= T_PARA;
  if ('`~#<>*+-_0123456789'.includes(ch)) f |= T_LIST;
  CT[i] = f;
}
const T_SLOW = T_STOP | T_NONALNUM | T_HFW;

/** JavaScript's \s, for one code unit. */
function isWhite(c) {
  return (
    c === 32 ||
    (c >= 9 && c <= 13) ||
    (c >= 160 &&
      (c === 160 || c === 5760 || (c >= 8192 && c <= 8202) || c === 8232 || c === 8233 || c === 8239 || c === 8287 || c === 12288 || c === 65279))
  );
}

// ---------------------------------------------------------------------------------------------
// Helpers (marked's helpers.ts), same results.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeChar = (ch) => ESCAPES[ch];

function escapeHtml(html, encode) {
  if (encode) {
    if (o_escapeTest.test(html)) return html.replace(o_escapeReplace, escapeChar);
  } else if (o_escapeTestNoEncode.test(html)) return html.replace(o_escapeReplaceNoEncode, escapeChar);
  return html;
}

function numericReference(whole, dec, hex) {
  if (dec === undefined && hex === undefined) return '&amp;';
  const code = dec === undefined ? Number.parseInt(hex, 16) : Number.parseInt(dec, 10);
  return code === 0 || code > 1114111 || (code >= 55296 && code <= 57343) ? '�' : code === 38 ? '&amp;' : String.fromCodePoint(code);
}

function decodeNumericReferences(text) {
  // the test needs "&#" somewhere, so a text without "&" is returned as it is
  if (text.indexOf('&') === -1) return text;
  return o_numericCharacterReference.test(text) ? text.replace(o_numericCharacterReferenceOrAmpersand, numericReference) : text;
}

function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(o_percentDecode, '%');
  } catch {
    return null;
  }
  return href;
}

function pipeReplacer(match, offset, str) {
  let escaped = false;
  let curr = offset;
  while (--curr >= 0 && str[curr] === '\\') escaped = !escaped;
  return escaped ? '|' : ' |';
}

function splitCells(tableRow, count) {
  // Without a backslash no pipe is escaped: every pipe gets a space before it and the row is split at
  // exactly those, which is splitting the row at its pipes.
  const plain = tableRow.indexOf('\\') === -1;
  const cells = plain ? tableRow.split('|') : tableRow.replace(o_findPipe, pipeReplacer).split(o_splitPipe);
  let i = 0;
  if (!cells[0].trim()) cells.shift();
  if (cells.length > 0 && !cells.at(-1)?.trim()) cells.pop();
  if (count) {
    if (cells.length > count) cells.splice(count);
    else while (cells.length < count) cells.push('');
  }
  if (plain) for (; i < cells.length; i++) cells[i] = cells[i].trim();
  else for (; i < cells.length; i++) cells[i] = cells[i].trim().replace(o_slashPipe, '|');
  return cells;
}

/** Removes every trailing `code` code unit (marked's rtrim, never inverted here). */
function rtrim(str, code) {
  let n = str.length;
  while (n > 0 && str.charCodeAt(n - 1) === code) n--;
  return n === str.length ? str : str.slice(0, n);
}

function trimTrailingBlankLines(str) {
  const lines = str.split('\n');
  let end = lines.length - 1;
  while (end >= 0 && o_blankLine.test(lines[end])) end--;
  return lines.length - end <= 2 ? str : lines.slice(0, end + 1).join('\n');
}

function normalizeLabel(label) {
  return label.trim().replace(o_multipleSpaceGlobal, ' ').toLowerCase().toUpperCase().toLowerCase();
}

function findClosingBracket(str, b) {
  if (str.indexOf(b[0]) === -1 && str.indexOf(b[1]) === -1) return -1;
  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') i++;
    else if (str[i] === b[0]) level++;
    else if (str[i] === b[1]) {
      level--;
      if (level < 0) return i;
    }
  }
  return level > 0 ? -2 : -1;
}

function expandTabs(line, indent = 0) {
  if (line.indexOf('\t') === -1) return line;
  let col = indent;
  let expanded = '';
  for (const char of line) {
    if (char === '\t') {
      const added = 4 - (col % 4);
      expanded += ' '.repeat(added);
      col += added;
    } else {
      expanded += char;
      col++;
    }
  }
  return expanded;
}
const expandTabs0 = (line) => expandTabs(line, 0);

function indentCodeCompensation(raw, text) {
  const matchIndentToCode = raw.match(o_indentCodeCompensation);
  if (matchIndentToCode === null) return text;
  const indentToCode = matchIndentToCode[1];
  return text
    .split('\n')
    .map((node) => {
      const matchIndentInNode = node.match(o_beginningSpace);
      if (matchIndentInNode === null) return node;
      const [indentInNode] = matchIndentInNode;
      return node.slice(Math.min(indentInNode.length, indentToCode.length));
    })
    .join('\n');
}

function linkLabelHasTag(src, label, offset) {
  if (!label.includes('<')) return false;
  for (let i = 0; i < label.length; i++) {
    if (label[i] === '\\') {
      i++;
      continue;
    }
    if (label[i] === '`') {
      const m = i_code.exec(label.slice(i));
      if (m) {
        i += m[0].length - 1;
        continue;
      }
    }
    if (label[i] !== '<') continue;
    const rest = src.slice(offset + i);
    const m = i_tag.exec(rest) || i_autolink.exec(rest);
    if (m) {
      if (m[0].length > label.length - i) return true;
      i += m[0].length - 1;
    }
  }
  return false;
}

/** How many code points `s` holds ([...s].length). */
function codePoints(s) {
  let n = s.length;
  for (let i = 0; i < s.length - 1; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        n--;
        i++;
      }
    }
  }
  return n;
}

/** The length in code units of the first code point of `s` ([...s][0].length). */
function firstPointLength(s) {
  const c = s.charCodeAt(0);
  if (c >= 0xd800 && c <= 0xdbff && s.length > 1) {
    const d = s.charCodeAt(1);
    if (d >= 0xdc00 && d <= 0xdfff) return 2;
  }
  return 1;
}

/** The last code point of s.slice(max(0, end - 2), end), or '' ([...that].at(-1) ?? ''). */
function pointBefore(s, end) {
  if (end <= 0) return '';
  const d = s.charCodeAt(end - 1);
  if (d >= 0xdc00 && d <= 0xdfff && end >= 2) {
    const c = s.charCodeAt(end - 2);
    if (c >= 0xd800 && c <= 0xdbff) return s.slice(end - 2, end);
  }
  return s[end - 1];
}

/** True when str ends \n[ \t]*\n[ \t]* (marked's doubleBlankLine test). */
function endsWithDoubleBlankLine(str) {
  let i = str.length - 1;
  while (i >= 0 && (str.charCodeAt(i) === 32 || str.charCodeAt(i) === 9)) i--;
  if (i < 0 || str.charCodeAt(i) !== 10) return false;
  i--;
  while (i >= 0 && (str.charCodeAt(i) === 32 || str.charCodeAt(i) === 9)) i--;
  return i >= 0 && str.charCodeAt(i) === 10;
}

/** s.search(/[^ ]/) */
function firstNonSpace(s) {
  const n = s.length;
  let i = 0;
  while (i < n && s.charCodeAt(i) === 32) i++;
  return i === n ? -1 : i;
}

// ---------------------------------------------------------------------------------------------
// Hand-written matchers. Each returns exactly what the marked regex it stands for would match.

/**
 * The length of block.paragraph's match on src (src never starts with a line end here: the space rule
 * takes those first). The rule is a first line, then every following non-empty line whose start does
 * not match STOP. A line whose first character cannot begin any of STOP's alternatives but the table
 * one (which may begin with anything) is taken without running STOP, unless the line after it could be
 * a table's delimiter row (it would start, after at most three spaces, with | : or -).
 */
function paragraphEnd(src) {
  if (src.length === 0) return 0;
  const len = src.length;
  let i = src.indexOf('\n');
  while (i !== -1) {
    const s = i + 1;
    if (s >= len) return i;
    const ch = src.charCodeAt(s);
    if (ch === 10) return i;
    if (ch > 127 || (CT[ch] & T_PARA) === 0) {
      const j = src.indexOf('\n', s);
      if (j === -1) return len;
      const d = markerAfter(src, j + 1, len);
      if (d === 124 || d === 58 || d === 45) {
        PARA_STOP.lastIndex = s;
        if (PARA_STOP.test(src)) return i;
      }
      i = j;
      continue;
    }
    PARA_STOP.lastIndex = s;
    if (PARA_STOP.test(src)) return i;
    i = src.indexOf('\n', s);
  }
  return len;
}

/** The code unit after at most three spaces from k (0 at the end of src). */
function markerAfter(src, k, len) {
  let n = 0;
  while (k < len && n < 3 && src.charCodeAt(k) === 32) {
    k++;
    n++;
  }
  return k < len ? src.charCodeAt(k) : 0;
}

/**
 * What the table and lheading rules need of src before they can match at all:
 * bit 1: the second line starts, after at most three spaces, with | : or - (a table's delimiter row);
 * bit 2: before the first empty line, some line after the first starts, after at most three spaces,
 *        with = or - (a setext underline).
 */
function secondLineHints(src) {
  let i = src.indexOf('\n');
  if (i === -1) return 0;
  let hints = 0;
  let first = true;
  const len = src.length;
  while (i !== -1) {
    if (i + 1 >= len) break;
    if (src.charCodeAt(i + 1) === 10) break;
    const d = markerAfter(src, i + 1, len);
    if (first) {
      first = false;
      if (d === 124 || d === 58 || d === 45) hints |= 1;
    }
    if (d === 61 || d === 45) {
      hints |= 2;
      break;
    }
    i = src.indexOf('\n', i + 1);
  }
  return hints;
}

/** (?= {2,}\n) at q */
function hardBreakAt(src, q) {
  const len = src.length;
  if (q + 2 >= len || src.charCodeAt(q) !== 32 || src.charCodeAt(q + 1) !== 32) return false;
  q += 2;
  while (q < len && src.charCodeAt(q) === 32) q++;
  return q < len && src.charCodeAt(q) === 10;
}

/** (?=(?:mailto|xmpp):) at q */
function mailProtocolAt(src, q) {
  if (q >= src.length) return false;
  const c = src.charCodeAt(q);
  if (c === 109) return src.startsWith('mailto:', q);
  if (c === 120) return src.startsWith('xmpp:', q);
  return false;
}

/** (?=[a-zA-Z0-9.!#$%&'*+\/=?_`{|}~-]+@) at q */
function mailNameAt(src, q) {
  const len = src.length;
  const start = q;
  while (q < len) {
    const c = src.charCodeAt(q);
    if (c > 127 || (CT[c] & T_NONEMAIL) !== 0) return q > start && c === 64;
    q++;
  }
  return false;
}

// Where inline.text ends when no e-mail name is in sight: before one of \ < ! [ ` * ~ _, before "http",
// "ftp://" or a "www." that follows a space or one of * _ ~ (, before a hard break's spaces, or before a
// mail protocol that follows a non-alphanumeric. Zero-width, so lastIndex is left at the place.
const TEXT_END = /(?=[\\<!\[`*~_]|[hH][tT][tT][pP]|[fF][tT][pP]:\/\/|(?<![^\s*_~(])www\.| {2,}\n|(?<![a-zA-Z0-9])(?:mailto|xmpp):)/g;

// An inline source none of whose characters can start anything but text: no \ < ! [ ` * ~ _ @ &, no
// hard break, no "http", "ftp", "www." and no mail protocol.
const NOT_PLAIN = /[\\<!\[`*~_@&]|  \n|[hH][tT][tT][pP]|[fF][tT][pP]|www\.|mailto:|xmpp:/;

/**
 * The length of inline.text's match on src (never empty). hasAt is false only when src holds no "@",
 * in which case no e-mail lookahead can match. The rule, in the order the regex tries it:
 *   one non-alphanumeric before mailto: or xmpp:, alone; else
 *   a first unit (a run of backticks, a run of tildes, or one other code unit), ended at once when a
 *   backtick or tilde, a hard break's spaces or an e-mail name follows; else extended one code unit at a
 *   time to the first place where a stop follows (one of \ < ! [ ` * ~ _, "http", "ftp://", a "www."
 *   after a space or one of * _ ~ (, or the end), or where the unit there is the last before a hard
 *   break's spaces, a mail protocol or an e-mail name (that unit is then taken too).
 */
function textLength(src, hasAt) {
  const len = src.length;
  const c0 = src.charCodeAt(0);
  if (!hasAt && c0 !== 96 && c0 !== 126) {
    // The first unit is one code unit and no e-mail name can follow, so the text ends at the first
    // place from 1 on where TEXT_END matches: at 1 that is a backtick or tilde, a hard break's spaces or
    // (after a non-alphanumeric first unit only, as the rule has it) a mail protocol; later, any stop.
    TEXT_END.lastIndex = 1;
    return TEXT_END.test(src) ? TEXT_END.lastIndex : len;
  }
  if ((c0 > 127 || (CT[c0] & T_NONALNUM) !== 0) && mailProtocolAt(src, 1)) return 1;
  let p = 1;
  if (c0 === 96) while (p < len && src.charCodeAt(p) === 96) p++;
  else if (c0 === 126) while (p < len && src.charCodeAt(p) === 126) p++;
  if (p >= len) return len;
  let ch = src.charCodeAt(p);
  if (ch === 96 || ch === 126) return p;
  if (ch === 32 && hardBreakAt(src, p)) return p;
  if (!hasAt) {
    // no e-mail name can follow: the first place TEXT_END matches is where the text ends, but for a
    // mail protocol right after the first unit (only a unit the loop walked over is taken before one)
    let from = p;
    for (;;) {
      TEXT_END.lastIndex = from;
      if (!TEXT_END.test(src)) return len;
      const k = TEXT_END.lastIndex;
      if (k === p) {
        ch = src.charCodeAt(k);
        if (ch === 109 || ch === 120) {
          from = k + 1;
          continue;
        }
      }
      return k;
    }
  }
  if (mailNameAt(src, p)) return p;
  for (; p < len; p++) {
    ch = src.charCodeAt(p);
    let nonEmail = true;
    if (ch < 128) {
      const f = CT[ch];
      // a letter (not h, f, w) or a digit never ends the text and is never the unit before an end
      // (the hard break after one is seen at its first space, below)
      if ((f & T_SLOW) === 0) continue;
      if ((f & T_STOP) !== 0) return p;
      if ((f & T_HFW) !== 0) {
        if (ch === 119) {
          if (p + 3 < len && src.charCodeAt(p + 1) === 119 && src.charCodeAt(p + 2) === 119 && src.charCodeAt(p + 3) === 46) {
            const b = src.charCodeAt(p - 1);
            if (b === 42 || b === 95 || b === 126 || b === 40 || isWhite(b)) return p;
          }
        } else if ((ch | 32) === 104) {
          if (p + 3 < len && (src.charCodeAt(p + 1) | 32) === 116 && (src.charCodeAt(p + 2) | 32) === 116 && (src.charCodeAt(p + 3) | 32) === 112) return p;
        } else if (
          p + 5 < len &&
          (src.charCodeAt(p + 1) | 32) === 116 &&
          (src.charCodeAt(p + 2) | 32) === 112 &&
          src.charCodeAt(p + 3) === 58 &&
          src.charCodeAt(p + 4) === 47 &&
          src.charCodeAt(p + 5) === 47
        )
          return p;
        continue;
      }
      // [^ ](?= {2,}\n): the unit before these spaces was not a space, and nothing ended the text there
      if (ch === 32 && src.charCodeAt(p - 1) !== 32 && hardBreakAt(src, p)) return p;
      nonEmail = (f & T_NONEMAIL) !== 0;
    }
    // a non-alphanumeric that is not a stop: taken as the last unit before a mail protocol or name
    if (p + 1 >= len) return len;
    const n = src.charCodeAt(p + 1);
    if ((n === 109 || n === 120) && mailProtocolAt(src, p + 1)) return p + 1;
    if (hasAt && nonEmail && mailNameAt(src, p + 1)) return p + 1;
  }
  return len;
}

/**
 * False only when inline.url cannot match src, whose first code unit is c: the rule starts with
 * mailto: or xmpp:, http / https / ftp (any case), www. or an e-mail name ([A-Za-z0-9._+-]+ then @).
 */
function urlPossible(src, c, hasAt) {
  if (c > 127 || (CT[c] & T_URLMAIL) === 0) return false;
  const len = src.length;
  const d = len > 1 ? src.charCodeAt(1) : 0;
  switch (c) {
    case 104:
    case 72:
    case 102:
    case 70:
      if ((d | 32) === 116) return true;
      break;
    case 119:
      if (d === 119) return true;
      break;
    case 109:
      if (d === 97) return true;
      break;
    case 120:
      if (d === 109) return true;
      break;
  }
  if (!hasAt) return false;
  let q = 1;
  while (q < len) {
    const e = src.charCodeAt(q);
    if (e > 127 || (CT[e] & T_URLMAIL) === 0) return e === 64;
    q++;
  }
  return false;
}

/**
 * marked's closer bound for one delimiter (ch, code) in a masked source: the start of the last run of
 * the delimiter that does not follow a space, tab, line end, carriage return or form feed (nor start
 * the source), or -1.
 */
function lastCloser(masked, ch, code) {
  let j = masked.lastIndexOf(ch);
  while (j !== -1) {
    let s = j;
    while (s > 0 && masked.charCodeAt(s - 1) === code) s--;
    if (s === 0) return -1;
    const b = masked.charCodeAt(s - 1);
    if (b !== 32 && b !== 9 && b !== 10 && b !== 13 && b !== 12) return s;
    j = masked.lastIndexOf(ch, s - 1);
  }
  return -1;
}

// inline.punctuation on one ASCII character (the rule is one character long: ^((?![*_])[\s\p{P}\p{S}])).
const PUNCT_SPACE = new Uint8Array(128);
for (let i = 0; i < 128; i++) PUNCT_SPACE[i] = i_punctuation.test(String.fromCharCode(i)) ? 1 : 0;

// inline.escape's second character: ^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])
const ESCAPABLE = new Uint8Array(128);
for (let i = 0; i < 128; i++) ESCAPABLE[i] = i_escape.test('\\' + String.fromCharCode(i)) ? 1 : 0;

/** !!inline.punctuation.exec(str) */
function isPunctSpace(str) {
  if (str.length === 1) {
    const c = str.charCodeAt(0);
    if (c < 128) return PUNCT_SPACE[c] === 1;
  }
  return i_punctuation.test(str);
}

// ---------------------------------------------------------------------------------------------
// The lexer: marked's Lexer and Tokenizer in one class, GFM rules only (marked's defaults).
class Lexer {
  constructor() {
    this.tokens = [];
    this.links = Object.create(null);
    this.linkCount = 0;
    this.inlineQueue = [];
    this.inLink = false;
    this.inRawBlock = false;
    this.linkEmitted = false;
    this.linkParenPossible = true;
    this.top = true;
    // of the inline source being lexed: the source, its emStrong mask and the closer bounds of * _ ~ in
    // the mask (each computed on first need; -2 is "not yet"), and whether it holds an "@"
    this.inlineSrc = '';
    this.masked = null;
    this.lastAst = -2;
    this.lastUnd = -2;
    this.lastDel = -2;
    this.hasAt = false;
    this.hasAmp = false; // whether it holds an "&" (only then can a text hold a character reference)
  }

  lex(src) {
    if (src.indexOf('\r') !== -1) src = src.replace(o_carriageReturn, '\n');
    this.blockTokens(src, this.tokens, false);
    const queue = this.inlineQueue;
    for (let i = 0; i < queue.length; i++) {
      const next = queue[i];
      this.inRawBlock = false;
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }

  inline(src) {
    const tokens = [];
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }

  blockTokens(src, tokens, lastParagraphClipped) {
    while (src) {
      let token;
      const c = src.charCodeAt(0);
      // Every rule but table, lheading, paragraph and text needs a particular first character; a space
      // or a tab may lead to any of them, so those take the whole sequence in marked's order.
      const any = c === 32 || c === 9;

      if (any || c === 10) {
        const cap = b_newline.exec(src);
        if (cap !== null && cap[0].length > 0) {
          const raw = cap[0];
          src = src.substring(raw.length);
          const last = tokens.at(-1);
          if (raw.length === 1 && last !== undefined) last.raw += '\n';
          else tokens.push({ type: 'space', raw });
          continue;
        }
      }

      if (any && (token = this.code(src))) {
        src = src.substring(token.raw.length);
        const last = tokens.at(-1);
        if (last?.type === 'paragraph' || last?.type === 'text') {
          last.raw += (last.raw.endsWith('\n') ? '' : '\n') + token.raw;
          last.text += '\n' + token.text;
          this.inlineQueue.at(-1).src = last.text;
        } else tokens.push(token);
        continue;
      }

      if ((any || c === 96 || c === 126) && (token = this.fences(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      if ((any || c === 35) && (token = this.heading(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      if ((any || c === 45 || c === 95 || c === 42) && (token = this.hr(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      if ((any || c === 62) && (token = this.blockquote(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      if ((any || c === 42 || c === 43 || c === 45 || (c >= 48 && c <= 57)) && (token = this.list(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      if ((any || c === 60) && (token = this.html(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      if ((any || c === 91) && (token = this.def(src))) {
        src = src.substring(token.raw.length);
        const last = tokens.at(-1);
        if (last?.type === 'paragraph' || last?.type === 'text') {
          last.raw += (last.raw.endsWith('\n') ? '' : '\n') + token.raw;
          last.text += '\n' + token.raw;
          this.inlineQueue.at(-1).src = last.text;
        } else {
          if (!this.links[token.tag]) {
            this.links[token.tag] = { href: token.href, title: token.title };
            this.linkCount++;
          }
          tokens.push(token);
        }
        continue;
      }

      const hints = secondLineHints(src);

      if ((hints & 1) !== 0 && (token = this.table(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      if ((hints & 2) !== 0 && (token = this.lheading(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      if (this.top) {
        // block.paragraph always matches here (src does not start with a line end)
        const end = paragraphEnd(src);
        const raw = end === src.length ? src : src.slice(0, end);
        const last = tokens.at(-1);
        if (lastParagraphClipped && last?.type === 'paragraph') {
          last.raw += (last.raw.endsWith('\n') ? '' : '\n') + raw;
          last.text += '\n' + raw;
          this.inlineQueue.at(-1).src = last.text;
        } else tokens.push({ type: 'paragraph', raw, text: raw, tokens: this.inline(raw) });
        lastParagraphClipped = false;
        src = src.substring(end);
        continue;
      }

      {
        // block.text: ^[^\n]+ (src does not start with a line end)
        const nl = src.indexOf('\n');
        const raw = nl === -1 ? src : src.slice(0, nl);
        src = src.substring(raw.length);
        const last = tokens.at(-1);
        if (last?.type === 'text') {
          last.raw += (last.raw.endsWith('\n') ? '' : '\n') + raw;
          last.text += '\n' + raw;
          this.inlineQueue.at(-1).src = last.text;
        } else tokens.push({ type: 'text', raw, text: raw, tokens: this.inline(raw) });
      }
    }
    this.top = true;
    return tokens;
  }

  code(src) {
    const cap = b_code.exec(src);
    if (cap) {
      const raw = trimTrailingBlankLines(cap[0]);
      const text = raw.replace(o_codeRemoveIndent, '');
      return { type: 'code', raw, codeBlockStyle: 'indented', text };
    }
  }

  fences(src) {
    const cap = b_fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || '');
      return { type: 'code', raw, lang: cap[2] ? cap[2].trim().replace(i_anyPunctuation, '$1') : cap[2], text };
    }
  }

  heading(src) {
    const cap = b_heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (o_endingHash.test(text)) {
        const trimmed = rtrim(text, 35);
        if (!trimmed || o_endingSpaceTabChar.test(trimmed)) text = trimmed.trim();
      }
      return { type: 'heading', raw: rtrim(cap[0], 10), depth: cap[1].length, text, tokens: this.inline(text) };
    }
  }

  hr(src) {
    const cap = b_hr.exec(src);
    if (cap) return { type: 'hr', raw: rtrim(cap[0], 10) };
  }

  blockquote(src) {
    const cap = b_blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], 10).split('\n');
      let raw = '';
      let text = '';
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          if (o_blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) currentLines.push(lines[i]);
          else break;
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join('\n');
        const currentText = currentRaw
          .replace(o_blockquoteMarkerWhitespace, (match, marker, whitespace) => marker + expandTabs(whitespace, marker.length))
          .replace(o_blockquoteSetextReplace, '\n    $1')
          .replace(o_blockquoteSetextReplace2, '');
        raw = raw ? `${raw}\n${currentRaw}` : currentRaw;
        text = text ? `${text}\n${currentText}` : currentText;
        const top = this.top;
        this.top = true;
        this.blockTokens(currentText, tokens, true);
        this.top = top;
        if (lines.length === 0) break;
        const lastToken = tokens.at(-1);
        if (
          lastToken?.type === 'code' ||
          lastToken?.type === 'heading' ||
          lastToken?.type === 'hr' ||
          lastToken?.type === 'html' ||
          lastToken?.type === 'table'
        )
          break;
        if (lastToken?.type === 'blockquote') {
          const oldToken = lastToken;
          const rest = lines.join('\n');
          const newText = oldToken.raw + '\n' + rest.replace(o_blockquoteSetextReplace2, '');
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          const leftover = newText.substring(newToken.raw.length).replace(o_leadingNewline, '');
          const leftoverLines = leftover ? leftover.split('\n').length : 0;
          const consumed = leftoverLines ? lines.slice(0, -leftoverLines) : lines;
          if (consumed.length > 0) raw = `${raw}\n${consumed.join('\n')}`;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          lines = lines.slice(consumed.length);
          if (lines.length > 0 && o_blockquoteStart.test(lines[0])) continue;
          break;
        } else if (lastToken?.type === 'list') {
          const oldToken = lastToken;
          const newText = oldToken.raw + '\n' + lines.join('\n');
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          const consumed = newToken.raw.length > oldToken.raw.length ? newText.slice(oldToken.raw.length + 1, newToken.raw.length).split('\n').length : 0;
          if (consumed > 0) {
            const taken = lines.slice(0, consumed).join('\n');
            raw = `${raw}\n${taken}`;
            text = `${text}\n${taken}`;
          }
          lines = lines.slice(consumed);
          continue;
        }
      }
      return { type: 'blockquote', raw, tokens, text };
    }
  }

  list(src) {
    let cap = b_list.exec(src);
    if (cap) {
      const whole = src;
      const bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list = { type: 'list', raw: '', ordered: isordered, start: isordered ? +bull.slice(0, -1) : '', loose: false, items: [] };
      const marker = bull.charCodeAt(bull.length - 1);
      const itemRegex = marker === 42 ? LI_STAR : marker === 43 ? LI_PLUS : marker === 45 ? LI_DASH : marker === 46 ? LI_DOT : LI_PAREN;
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let itemContents = '';
        if (!(cap = itemRegex.exec(src)) || b_hr.test(src)) break;
        const itemStart = whole.length - src.length;
        src = src.substring(cap[0].length);
        const head = cap[2];
        const headEnd = head.indexOf('\n');
        const firstLine = headEnd === -1 ? head : head.slice(0, headEnd);
        const bulletLength = cap[1].length;
        const fc = firstLine.length === 0 ? 0 : firstLine.charCodeAt(0);
        let line = fc === 32 || fc === 9 ? firstLine.replace(o_leadingSpaceTab, (t) => expandTabs(t, bulletLength)) : firstLine;
        let nl = src.indexOf('\n');
        let nextLine = nl === -1 ? src : src.slice(0, nl);
        let blankLine = !line.trim();
        let indent = 0;
        if (blankLine) indent = bulletLength + 1;
        else {
          indent = firstNonSpace(line);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += bulletLength;
        }
        if (blankLine && o_blankLine.test(nextLine)) {
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const slot = Math.max(0, Math.min(3, indent - 1));
          const nextBulletRegex = NEXT_BULLET[slot];
          const hrRegex = HR_BEGIN[slot];
          const fencesBeginRegex = FENCES_BEGIN[slot];
          const headingBeginRegex = HEADING_BEGIN[slot];
          const htmlBeginRegex = HTML_BEGIN[slot];
          const blockquoteBeginRegex = BLOCKQUOTE_BEGIN[slot];
          while (src) {
            nl = src.indexOf('\n');
            const rawLine = nl === -1 ? src : src.slice(0, nl);
            nextLine = rawLine;
            // the six rules below all start ^ {0,n} and then need one of ` ~ # < > * + - _ or a digit
            const lineLength = nextLine.length;
            let lead = 0;
            while (lead < lineLength && nextLine.charCodeAt(lead) === 32) lead++;
            const lc = lead < lineLength ? nextLine.charCodeAt(lead) : -1;
            const nextLineWithoutTabs = lc === 9 ? nextLine.replace(o_leadingSpaceTab, expandTabs0) : nextLine;
            // and each only after its own: fences ` ~, heading #, html <, blockquote >, bullet * + - or
            // a digit, hr - _ * (a line that passes two of them, * or -, is tried in marked's order)
            if (lc >= 0 && lc < 128 && (CT[lc] & T_LIST) !== 0) {
              if (lc === 96 || lc === 126) {
                if (fencesBeginRegex.test(nextLine)) break;
              } else if (lc === 35) {
                if (headingBeginRegex.test(nextLine)) break;
              } else if (lc === 60) {
                if (htmlBeginRegex.test(nextLine)) break;
              } else if (lc === 62) {
                if (blockquoteBeginRegex.test(nextLine)) break;
              } else if (lc === 95) {
                if (hrRegex.test(nextLine)) break;
              } else if (nextBulletRegex.test(nextLine) || ((lc === 42 || lc === 45) && hrRegex.test(nextLine))) break;
            }
            // lead is nextLineWithoutTabs.search(/[^ ]/) when the line has no leading tab and is not all spaces
            const nonSpace = lc === 9 ? firstNonSpace(nextLineWithoutTabs) : lc === -1 ? -1 : lead;
            // !nextLine.trim(): all spaces, or a first non-space that may be white space and then is checked
            const nextBlank = lc === -1 || ((lc <= 32 || lc > 127) && !nextLine.trim());
            if (nonSpace >= indent || nextBlank) itemContents += '\n' + nextLineWithoutTabs.slice(indent);
            else {
              if (
                blankLine ||
                firstNonSpace(line.replace(o_tabCharGlobal, '    ')) >= 4 ||
                fencesBeginRegex.test(line) ||
                headingBeginRegex.test(line) ||
                htmlBeginRegex.test(line) ||
                hrRegex.test(line)
              )
                break;
              const lazy =
                o_listSetext.test(nextLine) && b_lheading.test(`${line}\n${nextLine}`)
                  ? `    ${nextLineWithoutTabs.replace(o_listSetextIndent, '')}`
                  : nextLine;
              itemContents += '\n' + lazy;
            }
            blankLine = nextBlank;
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        const raw = whole.slice(itemStart, whole.length - src.length);
        if (!list.loose) {
          if (endsWithBlankLine) list.loose = true;
          else if (endsWithDoubleBlankLine(raw)) endsWithBlankLine = true;
        }
        list.items.push({ type: 'list_item', raw, task: o_listIsTask.test(itemContents), loose: false, text: itemContents, tokens: [] });
      }
      const lastItem = list.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else return;
      list.raw = whole.slice(0, whole.length - src.length).trimEnd();
      const items = list.items;
      for (let n = 0; n < items.length; n++) {
        const item = items[n];
        this.top = false;
        item.tokens = this.blockTokens(item.text, [], false);
        if (!list.loose) {
          let loose = false;
          const its = item.tokens;
          for (let k = 0; k < its.length; k++) {
            if (its[k].type === 'space' && o_anyLine.test(its[k].raw)) {
              loose = true;
              break;
            }
          }
          list.loose = loose;
        }
      }
      for (let n = 0; n < items.length; n++) {
        const item = items[n];
        if (!item.task) continue;
        const first = item.tokens[0];
        if (first?.type === 'text' || first?.type === 'paragraph') {
          item.text = item.text.replace(o_listReplaceTask, '');
          first.raw = first.raw.replace(o_listReplaceTask, '');
          first.text = first.text.replace(o_listReplaceTask, '');
          for (let q = this.inlineQueue.length - 1; q >= 0; q--) {
            if (o_listIsTask.test(this.inlineQueue[q].src)) {
              this.inlineQueue[q].src = this.inlineQueue[q].src.replace(o_listReplaceTask, '');
              break;
            }
          }
          const box = o_listTaskCheckbox.exec(item.raw);
          if (box) {
            const checkbox = { type: 'checkbox', raw: box[0] + ' ', checked: box[0] !== '[ ]' };
            item.checked = checkbox.checked;
            if (list.loose) {
              const t0 = item.tokens[0];
              if (t0 && (t0.type === 'paragraph' || t0.type === 'text') && 'tokens' in t0 && t0.tokens) {
                t0.raw = checkbox.raw + t0.raw;
                t0.text = checkbox.raw + t0.text;
                t0.tokens.unshift(checkbox);
              } else item.tokens.unshift({ type: 'paragraph', raw: checkbox.raw, text: checkbox.raw, tokens: [checkbox] });
            } else item.tokens.unshift(checkbox);
          }
        } else item.task = false;
      }
      if (list.loose) {
        for (let n = 0; n < items.length; n++) {
          const item = items[n];
          item.loose = true;
          const its = item.tokens;
          for (let k = 0; k < its.length; k++) if (its[k].type === 'text') its[k].type = 'paragraph';
        }
      }
      return list;
    }
  }

  html(src) {
    const cap = b_html.exec(src);
    if (cap) {
      const raw = trimTrailingBlankLines(cap[0]);
      return { type: 'html', block: true, raw, pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style', text: raw };
    }
  }

  def(src) {
    const cap = b_def.exec(src);
    if (cap) {
      if (cap[2].charCodeAt(0) !== 60 && findClosingBracket(cap[2], '()') !== -1) return;
      const tag = normalizeLabel(cap[1]);
      const href = cap[2] ? cap[2].replace(o_hrefBrackets, '$1').replace(i_anyPunctuation, '$1') : '';
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(i_anyPunctuation, '$1') : cap[3];
      return { type: 'def', tag, raw: rtrim(cap[0], 10), href, title };
    }
  }

  table(src) {
    const cap = b_table.exec(src);
    if (!cap || !o_tableDelimiter.test(cap[2])) return;
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(o_tableAlignChars, '').split('|');
    const rows = cap[3]?.trim() ? cap[3].replace(o_tableRowBlankLine, '').split('\n') : [];
    const item = { type: 'table', raw: rtrim(cap[0], 10), header: [], align: [], rows: [] };
    if (headers.length === aligns.length) {
      for (const align of aligns) {
        if (o_tableAlignRight.test(align)) item.align.push('right');
        else if (o_tableAlignCenter.test(align)) item.align.push('center');
        else if (o_tableAlignLeft.test(align)) item.align.push('left');
        else item.align.push(null);
      }
      for (let i = 0; i < headers.length; i++) item.header.push({ text: headers[i], tokens: this.inline(headers[i]), header: true, align: item.align[i] });
      const width = item.header.length;
      for (let r = 0; r < rows.length; r++) {
        const cells = splitCells(rows[r], width);
        const row = new Array(cells.length);
        for (let i = 0; i < cells.length; i++) row[i] = { text: cells[i], tokens: this.inline(cells[i]), header: false, align: item.align[i] };
        item.rows.push(row);
      }
      return item;
    }
  }

  lheading(src) {
    const cap = b_lheading.exec(src);
    if (cap) {
      const text = cap[1].trim();
      return { type: 'heading', raw: rtrim(cap[0], 10), depth: cap[2].charAt(0) === '=' ? 1 : 2, text, tokens: this.inline(text) };
    }
  }

  // ---- inline ----

  linkInText(text) {
    if (!text.includes('[')) return false;
    for (const m of text.matchAll(i_blockSkip)) if (i_link.test(m[0]) && text.charAt(m.index - 1) !== '!') return true;
    for (const m of text.matchAll(i_reflinkSearch)) {
      const whole = m[0];
      const open = whole.lastIndexOf('[');
      if (
        !(whole.charAt(0) === '!' || !Object.hasOwn(this.links, normalizeLabel(whole.slice(open + 1, -1)))) &&
        !(open > 1 && this.linkInText(whole.slice(1, open - 1)))
      )
        return true;
    }
    return false;
  }

  /** marked's emStrong mask of an inline source: links, code spans, escapes and tags blanked out. */
  mask(src) {
    let masked = src;
    const hasBracket = src.indexOf('[') !== -1;
    // with no link reference definition the reflink masker returns every match as it is
    if (hasBracket && this.linkCount > 0) {
      const search = i_reflinkSearch;
      const replacer = (match) => {
        const open = match.lastIndexOf('[');
        if (!Object.hasOwn(this.links, normalizeLabel(match.slice(open + 1, -1)))) return match;
        if (open > 1 && match.charAt(0) !== '!') {
          const text = match.slice(1, open - 1);
          if (this.linkInText(text)) return '[' + text.replace(search, replacer) + '][' + 'a'.repeat(match.length - open - 2) + ']';
        }
        return '[' + 'a'.repeat(match.length - 2) + ']';
      };
      masked = masked.replace(search, replacer);
    }
    const hasTick = src.indexOf('`') !== -1;
    // every alternative of the next rule needs a backtick or a backslash
    if (hasTick || src.indexOf('\\') !== -1) {
      masked = masked.replace(i_anyPunctuationOutsideCode, (match, ticks, escaped) =>
        escaped ? '+'.repeat(match.length) : ticks ? ticks + match.slice(ticks.length, -ticks.length).replace(o_backtickGlobal, '+') + ticks : match,
      );
    }
    // every alternative of blockSkip needs [ or ` or < ; the two replacements above add none of them
    if (hasBracket || hasTick || src.indexOf('<') !== -1) {
      masked = masked.replace(i_blockSkip, (match, _a, ticks) => {
        const skip = ticks ? ticks.length : 0;
        return match.slice(0, skip) + '[' + 'a'.repeat(match.length - skip - 2) + ']';
      });
    }
    return masked;
  }

  inlineTokens(src, tokens = []) {
    if (!NOT_PLAIN.test(src)) {
      // nothing but text: marked's loop would come to this one token
      if (src) tokens.push({ type: 'text', raw: src, text: src, escaped: this.inRawBlock });
      return tokens;
    }
    const parenPossible = this.linkParenPossible;
    const outerSrc = this.inlineSrc;
    const outerMasked = this.masked;
    const outerAst = this.lastAst;
    const outerUnd = this.lastUnd;
    const outerDel = this.lastDel;
    const outerHasAt = this.hasAt;
    const outerHasAmp = this.hasAmp;
    this.linkParenPossible = parenPossible && src.includes(')');
    this.inlineSrc = src;
    this.masked = null;
    this.lastAst = -2;
    this.lastUnd = -2;
    this.lastDel = -2;
    this.hasAt = src.indexOf('@') !== -1;
    this.hasAmp = src.indexOf('&') !== -1;
    this.inlineLoop(src, tokens);
    this.linkParenPossible = parenPossible;
    this.inlineSrc = outerSrc;
    this.masked = outerMasked;
    this.lastAst = outerAst;
    this.lastUnd = outerUnd;
    this.lastDel = outerDel;
    this.hasAt = outerHasAt;
    this.hasAmp = outerHasAmp;
    return tokens;
  }

  inlineLoop(src, tokens) {
    let keepPrevChar = false;
    let prevChar = '';
    const hasAt = this.hasAt;
    const hasAmp = this.hasAmp;
    while (src) {
      if (!keepPrevChar) prevChar = '';
      keepPrevChar = false;
      let token;
      const c = src.charCodeAt(0);

      if (c < 127 && (CT[c] & T_STOP) !== 0) {
        if (c === 92) {
          // escape: a backslash and one ASCII punctuation character
          if (src.length > 1) {
            const d = src.charCodeAt(1);
            if (d < 128 && ESCAPABLE[d] === 1) {
              tokens.push({ type: 'escape', raw: src.slice(0, 2), text: src[1] });
              src = src.substring(2);
              continue;
            }
          }
          // br: a backslash before a line end
          if ((token = this.br(src))) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            continue;
          }
        } else if (c === 60) {
          if ((token = this.tag(src))) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            continue;
          }
          if ((token = this.autolink(src))) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            continue;
          }
        } else if (c === 33 && (src.length === 1 || src.charCodeAt(1) !== 91)) {
          // an exclamation mark starts a link or a reference only before a bracket: this one is text
        } else if (c === 33 || c === 91) {
          if ((token = this.link(src))) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            continue;
          }
          if ((token = this.reflink(src))) {
            src = src.substring(token.raw.length);
            const last = tokens.at(-1);
            if (token.type === 'text' && last?.type === 'text') {
              last.raw += token.raw;
              last.text += token.text;
            } else tokens.push(token);
            continue;
          }
        } else if (c === 42 || c === 95) {
          if ((token = this.emStrong(src, prevChar))) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            continue;
          }
          // an e-mail name may start with an underscore
          if (c === 95 && hasAt && !this.inLink && urlPossible(src, c, hasAt) && (token = this.url(src))) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            continue;
          }
        } else if (c === 96) {
          if ((token = this.codespan(src))) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            continue;
          }
        } else if ((token = this.del(src, prevChar))) {
          // c is ~
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
      } else if (c === 32) {
        if (src.length > 1 && src.charCodeAt(1) === 32 && (token = this.br(src))) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
      } else if (!this.inLink && urlPossible(src, c, hasAt) && (token = this.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // inline.text always matches a non-empty src
      const end = textLength(src, hasAt);
      const raw = end === src.length ? src : src.slice(0, end);
      src = src.substring(end);
      const lastCode = raw.charCodeAt(end - 1);
      if (lastCode !== 95) prevChar = raw[end - 1];
      keepPrevChar = true;
      const text = hasAmp && !this.inRawBlock ? decodeNumericReferences(raw) : raw;
      const n = tokens.length;
      const last = n === 0 ? undefined : tokens[n - 1];
      if (last !== undefined && last.type === 'text') {
        last.raw += raw;
        last.text += text;
      } else tokens.push({ type: 'text', raw, text, escaped: this.inRawBlock });
    }
    return tokens;
  }

  tag(src) {
    const cap = i_tag.exec(src);
    if (cap) {
      const raw = cap[0];
      if (!this.inLink && o_startATag.test(raw)) this.inLink = true;
      else if (this.inLink && o_endATag.test(raw)) this.inLink = false;
      if (!this.inRawBlock && o_startPreScriptTag.test(raw)) this.inRawBlock = true;
      else if (this.inRawBlock && o_endPreScriptTag.test(raw)) this.inRawBlock = false;
      return { type: 'html', raw, inLink: this.inLink, inRawBlock: this.inRawBlock, block: false, text: raw };
    }
  }

  outputLink(cap, href, title, raw) {
    const text = cap[1].replace(o_outputLinkReplace, '$1');
    const image = cap[0].charAt(0) === '!';
    const inLink = this.inLink;
    const linkEmitted = this.linkEmitted;
    const inRawBlock = this.inRawBlock;
    this.inLink = true;
    this.linkEmitted = false;
    const tokens = this.inlineTokens(text);
    const emitted = this.linkEmitted;
    this.linkEmitted = linkEmitted;
    this.inLink = inLink;
    if (!image) {
      if (emitted) {
        this.inRawBlock = inRawBlock;
        return;
      }
      this.linkEmitted = true;
    }
    return { type: image ? 'image' : 'link', raw, href, title: title || null, text, tokens };
  }

  link(src) {
    if (this.linkParenPossible === false) return;
    const cap = i_link.exec(src);
    if (cap) {
      const offset = cap[0].charAt(0) === '!' ? 2 : 1;
      if (linkLabelHasTag(src, cap[1], offset)) return;
      const trimmedUrl = cap[2].trim();
      if (trimmedUrl.length !== 0 && trimmedUrl.charCodeAt(0) === 60) {
        if (trimmedUrl.charCodeAt(trimmedUrl.length - 1) !== 62) return;
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), 92);
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) return;
      } else {
        const lastParenIndex = findClosingBracket(cap[2], '()');
        if (lastParenIndex === -2) return;
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf('!') === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = '';
        }
      }
      const rtrimSlash = rtrim(cap[0].slice(0, -1), 92);
      if ((cap[0].length - rtrimSlash.length) % 2 === 0) return;
      let href = cap[2];
      const title = cap[3] ? cap[3].slice(1, -1) : '';
      href = href.trim();
      if (href.length !== 0 && href.charCodeAt(0) === 60) href = href.slice(1, -1);
      return this.outputLink(cap, href && href.replace(i_anyPunctuation, '$1'), title && title.replace(i_anyPunctuation, '$1'), cap[0]);
    }
  }

  reflink(src) {
    let cap;
    if ((cap = i_reflink.exec(src)) || (cap = i_nolink.exec(src))) {
      const offset = cap[0].charAt(0) === '!' ? 2 : 1;
      if (linkLabelHasTag(src, cap[1], offset)) return;
      const link = this.links[normalizeLabel(cap[2] || cap[1])];
      if (!link) {
        const text = cap[0].charAt(0);
        return { type: 'text', raw: text, text };
      }
      return this.outputLink(cap, link.href, link.title, cap[0]);
    }
  }

  emStrong(src, prevChar) {
    let match = i_emStrongLDelim.exec(src);
    if (!match || (!match[1] && !match[2] && !match[3] && !match[4])) return;
    // the source holds a * or _ here, so marked lexes it against its mask
    let maskedSrc = this.masked;
    if (maskedSrc === null) maskedSrc = this.masked = this.mask(this.inlineSrc);
    const delimChar = match[0][0];
    const delimCode = match[0].charCodeAt(0);
    const prevIsDelim = prevChar === delimChar;
    const srcOffset = maskedSrc.length - src.length;
    let runStart = srcOffset;
    while (runStart > 0 && maskedSrc.charCodeAt(runStart - 1) === delimCode) runStart--;
    const charBeforeRun = pointBefore(maskedSrc, runStart);
    const beforeRunIsPunct = charBeforeRun === '*' || charBeforeRun === '_' || isPunctSpace(charBeforeRun);
    if (runStart < srcOffset) prevChar = charBeforeRun;
    const prevIsPunct = runStart < srcOffset ? beforeRunIsPunct : isPunctSpace(prevChar);
    if (match[4] && prevChar.match(o_unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[3] || '';
    if (!nextChar || !prevChar || prevIsPunct) {
      const lLength = codePoints(match[0]) - 1;
      let rDelim;
      let rLength;
      let delimTotal = lLength;
      let midDelimTotal = 0;
      const fullLength = srcOffset - runStart + lLength;
      const canClose = !!charBeforeRun.trim() && (!!nextChar || (delimChar === '*' && !beforeRunIsPunct));
      const endReg = delimCode === 42 ? i_emStrongRDelimAst : i_emStrongRDelimUnd;
      let last;
      if (delimCode === 42) {
        if (this.lastAst === -2) this.lastAst = lastCloser(maskedSrc, '*', 42);
        last = this.lastAst;
      } else {
        if (this.lastUnd === -2) this.lastUnd = lastCloser(maskedSrc, '_', 95);
        last = this.lastUnd;
      }
      const base = maskedSrc.length - src.length + lLength;
      if (last < base) return;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      const limit = last - base;
      endReg.lastIndex = 0;
      while ((match = endReg.exec(maskedSrc)) !== null && !(match.index > limit)) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = rDelim.length; // a run of * or _
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6] || canClose) {
          if (prevIsDelim && (match[5] || match[6])) break;
          if (fullLength % 3 && !((fullLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = firstPointLength(match[0]);
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text = raw.slice(1, -1);
          return { type: 'em', raw, text, tokens: this.inlineTokens(text) };
        }
        const text = raw.slice(2, -2);
        return { type: 'strong', raw, text, tokens: this.inlineTokens(text) };
      }
    }
  }

  codespan(src) {
    const cap = i_code.exec(src);
    if (cap) {
      let text = cap[2].replace(o_newLineCharGlobal, ' ');
      const hasNonSpaceChars = o_nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = text.charCodeAt(0) === 32 && text.charCodeAt(text.length - 1) === 32;
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) text = text.substring(1, text.length - 1);
      return { type: 'codespan', raw: cap[0], text };
    }
  }

  br(src) {
    const cap = i_br.exec(src);
    if (cap) return { type: 'br', raw: cap[0] };
  }

  del(src, prevChar) {
    let match = i_delLDelim.exec(src);
    if (!match) return;
    const nextChar = match[1] || '';
    if (!nextChar || !prevChar || isPunctSpace(prevChar)) {
      let maskedSrc = this.masked;
      if (maskedSrc === null) maskedSrc = this.masked = this.mask(this.inlineSrc);
      const lLength = codePoints(match[0]) - 1;
      let rDelim;
      let rLength;
      let delimTotal = lLength;
      const endReg = i_delRDelim;
      if (this.lastDel === -2) this.lastDel = lastCloser(maskedSrc, '~', 126);
      const last = this.lastDel;
      const base = maskedSrc.length - src.length + lLength;
      if (last < base) return;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      const limit = last - base;
      endReg.lastIndex = 0;
      while ((match = endReg.exec(maskedSrc)) !== null && !(match.index > limit)) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = rDelim.length; // one or two ~
        if (rLength !== lLength) continue;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal);
        const lastCharLength = firstPointLength(match[0]);
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        const text = raw.slice(lLength, -lLength);
        return { type: 'del', raw, text, tokens: this.inlineTokens(text) };
      }
    }
  }

  autolink(src) {
    const cap = i_autolink.exec(src);
    if (cap) {
      const text = cap[1];
      const href = cap[2] === '@' ? 'mailto:' + text : text;
      return { type: 'link', raw: cap[0], text, href, autolink: true, tokens: [{ type: 'text', raw: text, text }] };
    }
  }

  url(src) {
    const cap = i_url.exec(src);
    if (cap) {
      let text;
      let href;
      if (cap[2] === '@') {
        text = cap[0];
        href = 'mailto:' + text;
      } else {
        let prev;
        do {
          prev = cap[0];
          cap[0] = i__backpedal.exec(cap[0])?.[0] ?? '';
        } while (prev !== cap[0]);
        text = cap[0];
        href = cap[1] === 'www.' ? 'http://' + cap[0] : cap[0];
      }
      return { type: 'link', raw: cap[0], text, href, autolink: true, tokens: [{ type: 'text', raw: text, text }] };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The renderer: marked's Parser, Renderer and TextRenderer with the default options.

function renderBlocks(tokens) {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 'space':
      case 'def':
        break;
      case 'hr':
        out += '<hr>\n';
        break;
      case 'heading':
        out += `<h${token.depth}>${renderInline(token.tokens)}</h${token.depth}>\n`;
        break;
      case 'code': {
        const lang = (token.lang || '').match(o_notSpaceStart)?.[0];
        const code = token.text ? token.text.replace(o_endingNewline, '') + '\n' : '';
        out += lang
          ? '<pre><code class="language-' + escapeHtml(lang) + '">' + (token.escaped ? code : escapeHtml(code, true)) + '</code></pre>\n'
          : '<pre><code>' + (token.escaped ? code : escapeHtml(code, true)) + '</code></pre>\n';
        break;
      }
      case 'table': {
        let header = '';
        let cell = '';
        for (let j = 0; j < token.header.length; j++) cell += renderCell(token.header[j]);
        header += `<tr>\n${cell}</tr>\n`;
        let body = '';
        for (let j = 0; j < token.rows.length; j++) {
          const row = token.rows[j];
          cell = '';
          for (let k = 0; k < row.length; k++) cell += renderCell(row[k]);
          body += `<tr>\n${cell}</tr>\n`;
        }
        if (body) body = `<tbody>${body}</tbody>`;
        out += '<table>\n<thead>\n' + header + '</thead>\n' + body + '</table>\n';
        break;
      }
      case 'blockquote':
        out += `<blockquote>\n${renderBlocks(token.tokens)}</blockquote>\n`;
        break;
      case 'list': {
        const ordered = token.ordered;
        const start = token.start;
        let body = '';
        for (let j = 0; j < token.items.length; j++) body += `<li>${renderBlocks(token.items[j].tokens)}</li>\n`;
        const tag = ordered ? 'ol' : 'ul';
        const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : '';
        out += '<' + tag + startAttr + '>\n' + body + '</' + tag + '>\n';
        break;
      }
      case 'checkbox':
        out += '<input ' + (token.checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> ';
        break;
      case 'html':
        out += token.text;
        break;
      case 'paragraph':
        out += `<p>${renderInline(token.tokens)}</p>\n`;
        break;
      case 'text':
        out += renderText(token);
        break;
      default:
        throw new Error('Token with "' + token.type + '" type was not found.');
    }
  }
  return out;
}

function renderCell(cell) {
  const content = renderInline(cell.tokens);
  const tag = cell.header ? 'th' : 'td';
  return (cell.align ? `<${tag} align="${cell.align}">` : `<${tag}>`) + content + `</${tag}>\n`;
}

function renderText(token) {
  return 'tokens' in token && token.tokens ? renderInline(token.tokens) : 'escaped' in token && token.escaped ? token.text : escapeHtml(token.text);
}

function renderInline(tokens) {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 'text':
      case 'escape':
        out += renderText(token);
        break;
      case 'html':
        out += token.text;
        break;
      case 'link': {
        const text = token.autolink ? escapeHtml(token.text, true) : renderInline(token.tokens);
        const clean = cleanUrl(token.href);
        if (clean === null) {
          out += text;
          break;
        }
        let link = '<a href="' + escapeHtml(clean, token.autolink) + '"';
        if (token.title) link += ' title="' + escapeHtml(token.title) + '"';
        out += link + '>' + text + '</a>';
        break;
      }
      case 'image': {
        let text = token.text;
        if (token.tokens) text = renderPlain(token.tokens);
        const clean = cleanUrl(token.href);
        if (clean === null) {
          out += escapeHtml(text);
          break;
        }
        let image = `<img src="${escapeHtml(clean)}" alt="${escapeHtml(text)}"`;
        if (token.title) image += ` title="${escapeHtml(token.title)}"`;
        out += image + '>';
        break;
      }
      case 'checkbox':
        out += '<input ' + (token.checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> ';
        break;
      case 'strong':
        out += `<strong>${renderInline(token.tokens)}</strong>`;
        break;
      case 'em':
        out += `<em>${renderInline(token.tokens)}</em>`;
        break;
      case 'codespan':
        out += `<code>${escapeHtml(token.text, true)}</code>`;
        break;
      case 'br':
        out += '<br>';
        break;
      case 'del':
        out += `<del>${renderInline(token.tokens)}</del>`;
        break;
      default:
        throw new Error('Token with "' + token.type + '" type was not found.');
    }
  }
  return out;
}

/** marked's TextRenderer: the plain text of inline tokens (an image's alt). */
function renderPlain(tokens) {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 'text':
      case 'escape':
      case 'html':
      case 'codespan':
        out += token.text;
        break;
      case 'link':
      case 'image':
      case 'strong':
      case 'em':
      case 'del':
        out += token.tokens ? renderPlain(token.tokens) : token.text;
        break;
      case 'checkbox':
        out += token.raw;
        break;
      case 'br':
        break;
      default:
        throw new Error('Token with "' + token.type + '" type was not found.');
    }
  }
  return out;
}

/**
 * The HTML marked 18.1.3 renders for `markdown`, with marked's defaults.
 * @param {string} markdown
 * @returns {string}
 */
export function parse(markdown) {
  if (typeof markdown !== 'string') throw new Error('marked(): input parameter is of type ' + Object.prototype.toString.call(markdown) + ', string expected');
  return renderBlocks(new Lexer().lex(markdown));
}
