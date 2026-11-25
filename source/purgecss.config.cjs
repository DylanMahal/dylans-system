// purgecss safelist. Lives here, not on the command line: the CLI only accepts plain strings,
// so a regex passed as an argument is silently treated as a literal class name.
// Anything built at runtime from a string (e.g. 'sk-'+name) must match a pattern below.
module.exports = {
  safelist: {
    standard: [
      'on','open','hidden','fx','poweron','edit-on','done','ok','bad','warn','pink','dim','num','p','active','sel','live','playing',
      /^(lcd-|st-|xl-|m[0-9]|t-|h[0-9]|is-|has-|lv|tier|cat-|ty-|fx-|sk-|nx-)/,
    ],
  },
};
