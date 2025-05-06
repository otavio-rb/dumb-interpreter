const RESERVED_KEYWORDS = require("./constants/RESERVED_KEYWORDS.js");
const TOKEN_TYPES = require("./constants/TOKEN_TYPES.JS");
const dispatch = require("../utils/dispatch.js");

class Lexer {
  constructor(fileData) {
    this.fileData = fileData;
    this.tokens = [];
    this._tokenize();
  }

  _tokenize() {
    const tokenRegex = /#!([\s\S]*?)#!|>=|<=|==|!=|&&|\|\||\d+(\.\d+)?|\b[a-zA-Z_]\w*\b|[=;+\-*></%()\[\]{},]|"(?:\\.|[^"])*"/g;
    this.tokens = [];

    for (let match of this.fileData.matchAll(tokenRegex)) {
      const value = match[0];
      this.tokens.push(this._classifyToken(value));
    }

    this.tokens.push({ type: "ENDFILE", value: null });
  }

  _classifyToken(value) {
    if (/^\d+(\.\d+)?$/.test(value)) return { type: "NUMBER", value: value };
    if (/^#!([\s\S]*?)#!$/.test(value)) return { type: "COMMENT", value }
    if (/^"([^"]*)"$/.test(value)) return { type: "STRING", value };
    if (value === ",") return { type: "COMMA", value };
    if (value === ".") return { type: "DOT", value }
    if (RESERVED_KEYWORDS[value])
      return { type: RESERVED_KEYWORDS[value], value };
    if (TOKEN_TYPES[value]) return { type: TOKEN_TYPES[value], value };
    if (/^[a-zA-Z_][\w]*$/.test(value)) return { type: "IDENTIFIER", value };

    dispatch(`Unexpected Error: Can't define token, the character is not defined: ${value}`);
  }
}

module.exports = Lexer;