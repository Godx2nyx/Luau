function randomName(prefix, used) {
  let name;

  do {
    name =
      `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  } while (used.has(name));

  used.add(name);
  return name;
}

function escapeLuauString(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function hideConstants(source) {
  const usedNames = new Set();

  const strings = [];
  const numbers = [];
  const booleans = [];

  const protectedParts = [];

  /*
   * Protect strings and comments first.
   * This prevents numbers or boolean words inside
   * strings/comments from being treated as constants.
   */
  let masked = source.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--\[\[[\s\S]*?\]\]|--[^\n]*/g,
    match => {
      const id =
        `\u0001${protectedParts.length}\u0002`;

      protectedParts.push(match);

      return id;
    }
  );

  /*
   * Collect string literals.
   */
  for (const part of protectedParts) {
    if (part.startsWith("--")) {
      continue;
    }

    if (
      part.startsWith('"') ||
      part.startsWith("'")
    ) {
      strings.push(part.slice(1, -1));
    }
  }

  /*
   * Collect number literals.
   */
  masked = masked.replace(
    /\b(?:0x[0-9a-f]+|\d+(?:\.\d+)?|\.\d+)\b/gi,
    match => {
      numbers.push(match);

      return (
        `\u0003N${numbers.length - 1}\u0004`
      );
    }
  );

  /*
   * Collect boolean literals.
   */
  masked = masked.replace(
    /\b(true|false)\b/g,
    match => {
      booleans.push(match);

      return (
        `\u0003B${booleans.length - 1}\u0004`
      );
    }
  );

  /*
   * Remove duplicate constants.
   */
  const uniqueStrings = [
    ...new Map(
      strings.map(value => [value, value])
    ).values()
  ];

  const uniqueNumbers = [
    ...new Map(
      numbers.map(value => [value, value])
    ).values()
  ];

  const uniqueBooleans = [
    ...new Map(
      booleans.map(value => [value, value])
    ).values()
  ];

  /*
   * Generate table names.
   */
  const stringTableName =
    uniqueStrings.length > 0
      ? randomName("__S", usedNames)
      : null;

  const numberTableName =
    uniqueNumbers.length > 0
      ? randomName("__N", usedNames)
      : null;

  const booleanTableName =
    uniqueBooleans.length > 0
      ? randomName("__B", usedNames)
      : null;

  /*
   * Restore protected strings/comments.
   *
   * String literals become table references.
   * Comments are restored unchanged.
   */
  masked = masked.replace(
    /\u0001(\d+)\u0002/g,
    (_, index) => {
      const original =
        protectedParts[Number(index)];

      // Comment
      if (original.startsWith("--")) {
        return original;
      }

      // String
      const value =
        original.slice(1, -1);

      const position =
        uniqueStrings.indexOf(value) + 1;

      return `${stringTableName}[${position}]`;
    }
  );

  /*
   * Replace number placeholders.
   */
  masked = masked.replace(
    /\u0003N(\d+)\u0004/g,
    (_, index) => {
      const value =
        numbers[Number(index)];

      const position =
        uniqueNumbers.indexOf(value) + 1;

      return `${numberTableName}[${position}]`;
    }
  );

  /*
   * Replace boolean placeholders.
   */
  masked = masked.replace(
    /\u0003B(\d+)\u0004/g,
    (_, index) => {
      const value =
        booleans[Number(index)];

      const position =
        uniqueBooleans.indexOf(value) + 1;

      return `${booleanTableName}[${position}]`;
    }
  );

  /*
   * Build constant tables.
   */
  const header = [];

  if (stringTableName) {
    header.push(
      `local ${stringTableName} = {`
    );

    for (const value of uniqueStrings) {
      header.push(
        `    "${escapeLuauString(value)}",`
      );
    }

    header.push("}");
  }

  if (numberTableName) {
    header.push(
      `local ${numberTableName} = {`
    );

    for (const value of uniqueNumbers) {
      header.push(
        `    ${value},`
      );
    }

    header.push("}");
  }

  if (booleanTableName) {
    header.push(
      `local ${booleanTableName} = {`
    );

    for (const value of uniqueBooleans) {
      header.push(
        `    ${value},`
      );
    }

    header.push("}");
  }

  return {
    source: masked,
    header: header.join("\n"),

    counts: {
      strings: uniqueStrings.length,
      numbers: uniqueNumbers.length,
      booleans: uniqueBooleans.length
    }
  };
}

module.exports = {
  hideConstants
};
