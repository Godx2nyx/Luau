// constant-hider.js
// Hides Luau constants without using constant tables or [index] access.
//
// Example:
//
// Before:
//     game:GetService("RunService")
//     task.wait(0.5)
//     if true then
//
// After:
//     local __S_xxxxxxx = "RunService"
//     local __N_xxxxxxx = 0.5
//     local __B_xxxxxxx = true
//
//     game:GetService(__S_xxxxxxx)
//     task.wait(__N_xxxxxxx)
//     if __B_xxxxxxx then

function randomName(prefix, used) {
  let name;

  do {
    name =
      `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  } while (used.has(name));

  used.add(name);

  return name;
}

function isIdentifierStart(char) {
  return /[A-Za-z_]/.test(char || "");
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_]/.test(char || "");
}

function isDigit(char) {
  return /[0-9]/.test(char || "");
}

function readQuotedString(source, start) {
  const quote = source[start];

  let i = start + 1;

  while (i < source.length) {
    const char = source[i];

    // Escape sequence
    if (char === "\\") {
      i += 2;
      continue;
    }

    // Closing quote
    if (char === quote) {
      return i + 1;
    }

    i++;
  }

  // Unterminated string.
  return source.length;
}

function readLineComment(source, start) {
  let i = start + 2;

  while (
    i < source.length &&
    source[i] !== "\n"
  ) {
    i++;
  }

  return i;
}

function readBlockComment(source, start) {
  const end = source.indexOf("]]", start + 4);

  if (end === -1) {
    return source.length;
  }

  return end + 2;
}

function readNumber(source, start) {
  let i = start;

  /*
   * Hexadecimal:
   *
   * 0x10
   * 0XFF
   */
  if (
    source[i] === "0" &&
    (source[i + 1] === "x" ||
      source[i + 1] === "X")
  ) {
    i += 2;

    while (
      i < source.length &&
      /[0-9A-Fa-f]/.test(source[i])
    ) {
      i++;
    }

    return i;
  }

  /*
   * Decimal numbers.
   *
   * Supports:
   * 123
   * 123.45
   * .45
   * 1e5
   * 1.5e-3
   */
  if (source[i] === ".") {
    i++;

    while (
      i < source.length &&
      isDigit(source[i])
    ) {
      i++;
    }
  } else {
    while (
      i < source.length &&
      isDigit(source[i])
    ) {
      i++;
    }

    if (source[i] === ".") {
      i++;

      while (
        i < source.length &&
        isDigit(source[i])
      ) {
        i++;
      }
    }
  }

  // Scientific notation
  if (
    source[i] === "e" ||
    source[i] === "E"
  ) {
    let j = i + 1;

    if (
      source[j] === "+" ||
      source[j] === "-"
    ) {
      j++;
    }

    const exponentStart = j;

    while (
      j < source.length &&
      isDigit(source[j])
    ) {
      j++;
    }

    // Only consume exponent when digits exist.
    if (j > exponentStart) {
      i = j;
    }
  }

  return i;
}

function hideConstants(source) {
  const usedNames = new Set();

  /*
   * Track existing identifiers so generated names
   * do not collide with user code.
   */
  for (let i = 0; i < source.length;) {
    const char = source[i];

    // Strings
    if (char === '"' || char === "'") {
      i = readQuotedString(source, i);
      continue;
    }

    // Comments
    if (source.startsWith("--[[", i)) {
      i = readBlockComment(source, i);
      continue;
    }

    if (source.startsWith("--", i)) {
      i = readLineComment(source, i);
      continue;
    }

    // Identifier
    if (isIdentifierStart(char)) {
      const start = i;

      i++;

      while (
        i < source.length &&
        isIdentifierPart(source[i])
      ) {
        i++;
      }

      usedNames.add(
        source.slice(start, i)
      );

      continue;
    }

    i++;
  }

  /*
   * Constant maps.
   *
   * The values are local variables, NOT tables.
   */
  const stringConstants = new Map();
  const numberConstants = new Map();
  const booleanConstants = new Map();

  function getStringName(value) {
    if (!stringConstants.has(value)) {
      stringConstants.set(
        value,
        randomName("__S", usedNames)
      );
    }

    return stringConstants.get(value);
  }

  function getNumberName(value) {
    if (!numberConstants.has(value)) {
      numberConstants.set(
        value,
        randomName("__N", usedNames)
      );
    }

    return numberConstants.get(value);
  }

  function getBooleanName(value) {
    if (!booleanConstants.has(value)) {
      booleanConstants.set(
        value,
        randomName("__B", usedNames)
      );
    }

    return booleanConstants.get(value);
  }

  /*
   * Escape a string literal safely.
   *
   * We keep the original literal contents rather
   * than decoding/re-encoding it. This prevents
   * escaped sequences such as "\\n" from changing
   * their runtime meaning.
   */
  function normalizeStringLiteral(value) {
    return value;
  }

  /*
   * Transform source directly.
   *
   * This scanner skips comments and strings correctly,
   * so constants inside them are never modified.
   */
  let output = "";
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    /*
     * Block comment
     */
    if (source.startsWith("--[[", i)) {
      const end = readBlockComment(source, i);

      output += source.slice(i, end);

      i = end;
      continue;
    }

    /*
     * Line comment
     */
    if (source.startsWith("--", i)) {
      const end = readLineComment(source, i);

      output += source.slice(i, end);

      i = end;
      continue;
    }

    /*
     * Quoted string
     */
    if (
      char === '"' ||
      char === "'"
    ) {
      const end =
        readQuotedString(source, i);

      const literal =
        source.slice(i, end);

      const name =
        getStringName(literal);

      output += name;

      i = end;
      continue;
    }

    /*
     * Identifier / keyword
     */
    if (isIdentifierStart(char)) {
      const start = i;

      i++;

      while (
        i < source.length &&
        isIdentifierPart(source[i])
      ) {
        i++;
      }

      const word =
        source.slice(start, i);

      /*
       * Boolean literals
       */
      if (word === "true") {
        output += getBooleanName("true");
      } else if (word === "false") {
        output += getBooleanName("false");
      } else {
        output += word;
      }

      continue;
    }

    /*
     * Number literal
     *
     * Don't treat the "." in something like:
     * object.property
     * as a number.
     */
    if (
      isDigit(char) ||
      (
        char === "." &&
        isDigit(source[i + 1])
      )
    ) {
      /*
       * Avoid interpreting a decimal portion of
       * an identifier-like token as a standalone number.
       */
      if (
        char === "." &&
        i > 0 &&
        isIdentifierPart(source[i - 1])
      ) {
        output += char;
        i++;
        continue;
      }

      const end =
        readNumber(source, i);

      const literal =
        source.slice(i, end);

      const name =
        getNumberName(literal);

      output += name;

      i = end;
      continue;
    }

    /*
     * Everything else is copied exactly.
     *
     * This means existing Luau [] syntax remains
     * untouched.
     */
    output += char;

    i++;
  }

  /*
   * Generate scalar local declarations.
   *
   * IMPORTANT:
   * There are no tables and no [index] access here.
   */
  const header = [];

  for (
    const [literal, name]
    of stringConstants
  ) {
    header.push(
      `local ${name} = ${normalizeStringLiteral(literal)}`
    );
  }

  for (
    const [literal, name]
    of numberConstants
  ) {
    header.push(
      `local ${name} = ${literal}`
    );
  }

  for (
    const [literal, name]
    of booleanConstants
  ) {
    header.push(
      `local ${name} = ${literal}`
    );
  }

  return {
    source: output,

    header: header.join("\n"),

    counts: {
      strings: stringConstants.size,
      numbers: numberConstants.size,
      booleans: booleanConstants.size
    }
  };
}

module.exports = {
  hideConstants
};
