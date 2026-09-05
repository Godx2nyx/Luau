// lexer.js
// Lightweight Luau lexer.
// Recognizes:
// - whitespace
// - comments
// - strings
// - identifiers / keywords
// - numbers
// - operators / symbols
//
// This lexer does NOT execute Luau code.

function isIdentifierStart(char) {
  return /[A-Za-z_]/.test(char || "");
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_]/.test(char || "");
}

function isDigit(char) {
  return /[0-9]/.test(char || "");
}

function isHexDigit(char) {
  return /[0-9A-Fa-f]/.test(char || "");
}

function tokenize(source) {
  if (typeof source !== "string") {
    throw new TypeError(
      "Source must be a string"
    );
  }

  const tokens = [];

  let i = 0;

  function push(type, value, start, end) {
    tokens.push({
      type,
      value,
      start,
      end
    });
  }

  /*
   * Read quoted string.
   */
  function readString(start) {
    const quote = source[start];

    let pos = start + 1;

    while (pos < source.length) {
      const char = source[pos];

      /*
       * Escape sequence.
       */
      if (char === "\\") {
        pos += 2;
        continue;
      }

      /*
       * Closing quote.
       */
      if (char === quote) {
        return pos + 1;
      }

      pos++;
    }

    return source.length;
  }

  /*
   * Read long comment:
   *
   * --[[
   * ...
   * ]]
   */
  function readLongComment(start) {
    const end =
      source.indexOf(
        "]]",
        start + 4
      );

    if (end === -1) {
      return source.length;
    }

    return end + 2;
  }

  /*
   * Read number.
   *
   * Supports:
   *
   * 123
   * 123.45
   * .45
   * 1e5
   * 1.5e-3
   * 0xFF
   */
  function readNumber(start) {
    let pos = start;

    /*
     * Hexadecimal.
     */
    if (
      source[pos] === "0" &&
      (
        source[pos + 1] === "x" ||
        source[pos + 1] === "X"
      )
    ) {
      pos += 2;

      while (
        pos < source.length &&
        isHexDigit(source[pos])
      ) {
        pos++;
      }

      return pos;
    }

    /*
     * Decimal beginning with dot.
     *
     * .5
     */
    if (source[pos] === ".") {
      pos++;

      while (
        pos < source.length &&
        isDigit(source[pos])
      ) {
        pos++;
      }
    }

    /*
     * Normal decimal.
     *
     * 123
     * 123.45
     */
    else {
      while (
        pos < source.length &&
        isDigit(source[pos])
      ) {
        pos++;
      }

      if (source[pos] === ".") {
        pos++;

        while (
          pos < source.length &&
          isDigit(source[pos])
        ) {
          pos++;
        }
      }
    }

    /*
     * Scientific notation.
     *
     * 1e5
     * 1.5e-3
     */
    if (
      source[pos] === "e" ||
      source[pos] === "E"
    ) {
      let exponent =
        pos + 1;

      if (
        source[exponent] === "+" ||
        source[exponent] === "-"
      ) {
        exponent++;
      }

      const exponentStart =
        exponent;

      while (
        exponent < source.length &&
        isDigit(source[exponent])
      ) {
        exponent++;
      }

      /*
       * Only consume exponent when
       * at least one digit exists.
       */
      if (
        exponent > exponentStart
      ) {
        pos = exponent;
      }
    }

    return pos;
  }

  /*
   * Multi-character operators.
   *
   * Longest operators must be checked first.
   */
  const multiOperators = [
    "...",
    "//",
    "<<",
    ">>",
    "==",
    "~=",
    "<=",
    ">=",
    "::",
    "+=",
    "-=",
    "*=",
    "/=",
    "%=",
    "^="
  ];

  while (i < source.length) {
    const start = i;
    const char = source[i];

    /*
     * Whitespace.
     */
    if (/\s/.test(char)) {
      i++;

      while (
        i < source.length &&
        /\s/.test(source[i])
      ) {
        i++;
      }

      push(
        "whitespace",
        source.slice(start, i),
        start,
        i
      );

      continue;
    }

    /*
     * Comments.
     */
    if (
      source.startsWith(
        "--[[",
        i
      )
    ) {
      i =
        readLongComment(i);

      push(
        "comment",
        source.slice(start, i),
        start,
        i
      );

      continue;
    }

    if (
      source.startsWith(
        "--",
        i
      )
    ) {
      i += 2;

      while (
        i < source.length &&
        source[i] !== "\n"
      ) {
        i++;
      }

      push(
        "comment",
        source.slice(start, i),
        start,
        i
      );

      continue;
    }

    /*
     * Quoted strings.
     */
    if (
      char === '"' ||
      char === "'"
    ) {
      i =
        readString(i);

      push(
        "string",
        source.slice(start, i),
        start,
        i
      );

      continue;
    }

    /*
     * Identifiers / keywords.
     */
    if (
      isIdentifierStart(char)
    ) {
      i++;

      while (
        i < source.length &&
        isIdentifierPart(
          source[i]
        )
      ) {
        i++;
      }

      const value =
        source.slice(
          start,
          i
        );

      const keywords = new Set([
        "and",
        "break",
        "do",
        "else",
        "elseif",
        "end",
        "false",
        "for",
        "function",
        "if",
        "in",
        "local",
        "nil",
        "not",
        "or",
        "repeat",
        "return",
        "then",
        "true",
        "until",
        "while",
        "continue",
        "type",
        "export",
        "typeof"
      ]);

      push(
        keywords.has(value)
          ? "keyword"
          : "identifier",
        value,
        start,
        i
      );

      continue;
    }

    /*
     * Numbers.
     */
    if (
      isDigit(char) ||
      (
        char === "." &&
        isDigit(
          source[i + 1]
        )
      )
    ) {
      /*
       * Do not treat the dot in:
       *
       * object.property
       *
       * as a number.
       */
      if (
        char === "." &&
        i > 0 &&
        isIdentifierPart(
          source[i - 1]
        )
      ) {
        push(
          "symbol",
          char,
          start,
          ++i
        );

        continue;
      }

      i =
        readNumber(i);

      push(
        "number",
        source.slice(start, i),
        start,
        i
      );

      continue;
    }

    /*
     * Multi-character operators.
     */
    let matchedOperator = null;

    for (
      const operator
      of multiOperators
    ) {
      if (
        source.startsWith(
          operator,
          i
        )
      ) {
        matchedOperator =
          operator;

        break;
      }
    }

    if (matchedOperator) {
      i +=
        matchedOperator.length;

      push(
        "operator",
        matchedOperator,
        start,
        i
      );

      continue;
    }

    /*
     * Single-character operators
     * and punctuation.
     */
    const singleOperators =
      "+-*/%^&|~=<>(){}[];:,.#";

    if (
      singleOperators.includes(
        char
      )
    ) {
      i++;

      push(
        "operator",
        char,
        start,
        i
      );

      continue;
    }

    /*
     * Unknown character.
     *
     * Keep it instead of silently
     * deleting source data.
     */
    i++;

    push(
      "unknown",
      char,
      start,
      i
    );
  }

  return tokens;
}

module.exports = {
  tokenize
};
