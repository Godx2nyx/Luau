// Lightweight Luau lexical scanner.
// Recognizes strings, comments, identifiers, numbers and symbols.
// This is intentionally conservative and does not execute source code.

function tokenize(source) {
  const tokens = [];
  let i = 0;

  const push = (type, value, start, end) => {
    tokens.push({
      type,
      value,
      start,
      end
    });
  };

  while (i < source.length) {
    const start = i;
    const c = source[i];

    // Whitespace
    if (/\s/.test(c)) {
      i++;

      while (i < source.length && /\s/.test(source[i])) {
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

    // Comments
    if (source.startsWith("--", i)) {
      // Multiline comment
      if (source.startsWith("--[[", i)) {
        const end = source.indexOf("]]", i + 4);

        i = end < 0
          ? source.length
          : end + 2;
      }

      // Single-line comment
      else {
        const end = source.indexOf("\n", i + 2);

        i = end < 0
          ? source.length
          : end;
      }

      push(
        "comment",
        source.slice(start, i),
        start,
        i
      );

      continue;
    }

    // Quoted strings
    if (c === '"' || c === "'") {
      const quote = c;

      i++;

      while (i < source.length) {
        // Escape sequence
        if (source[i] === "\\") {
          i += 2;
          continue;
        }

        // Closing quote
        if (source[i] === quote) {
          i++;
          break;
        }

        i++;
      }

      push(
        "string",
        source.slice(start, i),
        start,
        i
      );

      continue;
    }

    // Identifiers / keywords
    if (/[A-Za-z_]/.test(c)) {
      i++;

      while (
        i < source.length &&
        /[A-Za-z0-9_]/.test(source[i])
      ) {
        i++;
      }

      push(
        "identifier",
        source.slice(start, i),
        start,
        i
      );

      continue;
    }

    // Numeric literals
    if (
      /[0-9]/.test(c) ||
      (c === "." && /[0-9]/.test(source[i + 1] || ""))
    ) {
      i++;

      while (
        i < source.length &&
        /[A-Za-z0-9._]/.test(source[i])
      ) {
        i++;
      }

      push(
        "number",
        source.slice(start, i),
        start,
        i
      );

      continue;
    }

    // Everything else is a symbol/operator
    push(
      "symbol",
      c,
      start,
      ++i
    );
  }

  return tokens;
}

module.exports = {
  tokenize
};
