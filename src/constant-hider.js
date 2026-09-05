// constant-hider.js
// Conservative Luau constant hider.
// Never inserts control characters into generated Luau.

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

function unquoteString(value) {
  if (
    value.length >= 2 &&
    (
      value[0] === '"' ||
      value[0] === "'"
    ) &&
    value[value.length - 1] === value[0]
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function hideConstants(source) {
  const usedNames = new Set();

  const stringMap = new Map();
  const numberMap = new Map();
  const booleanMap = new Map();

  /*
   * Safe placeholders.
   *
   * IMPORTANT:
   * Do not use \u0001 / \u0002 / \u0003 / \u0004.
   * Those characters are invalid in generated Luau.
   */
  const protectedParts = [];

  function protect(match) {
    const id =
      `__LUAPROTECT_${protectedParts.length}__`;

    protectedParts.push(match);

    return id;
  }

  /*
   * Protect strings and comments.
   */
  let masked = source.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--\[\[[\s\S]*?\]\]|--[^\n]*/g,
    protect
  );

  /*
   * Collect constants from protected parts.
   */
  for (const part of protectedParts) {
    if (part.startsWith("--")) {
      continue;
    }

    if (
      part.startsWith('"') ||
      part.startsWith("'")
    ) {
      const value = unquoteString(part);

      if (!stringMap.has(value)) {
        stringMap.set(
          value,
          stringMap.size + 1
        );
      }
    }
  }

  /*
   * Collect numbers.
   *
   * Avoid numbers that are part of identifiers.
   */
  masked = masked.replace(
    /(?<![A-Za-z0-9_])(?:0x[0-9a-f]+|\d+(?:\.\d+)?|\.\d+)(?![A-Za-z0-9_])/gi,
    match => {
      if (!numberMap.has(match)) {
        numberMap.set(
          match,
          numberMap.size + 1
        );
      }

      return `__LUANUM_${numberMap.get(match)}__`;
    }
  );

  /*
   * Collect booleans.
   */
  masked = masked.replace(
    /(?<![A-Za-z0-9_])(true|false)(?![A-Za-z0-9_])/g,
    match => {
      if (!booleanMap.has(match)) {
        booleanMap.set(
          match,
          booleanMap.size + 1
        );
      }

      return `__LUABOOL_${booleanMap.get(match)}__`;
    }
  );

  /*
   * Generate table names.
   */
  const stringTableName =
    stringMap.size > 0
      ? randomName("__S", usedNames)
      : null;

  const numberTableName =
    numberMap.size > 0
      ? randomName("__N", usedNames)
      : null;

  const booleanTableName =
    booleanMap.size > 0
      ? randomName("__B", usedNames)
      : null;

  /*
   * Restore protected strings/comments.
   */
  masked = masked.replace(
    /__LUAPROTECT_(\d+)__/g,
    (_, index) => {
      const original =
        protectedParts[Number(index)];

      if (!original) {
        throw new Error(
          "Constant hider: invalid protected-part index"
        );
      }

      /*
       * Comments remain untouched.
       */
      if (original.startsWith("--")) {
        return original;
      }

      /*
       * Strings become string-table references.
       */
      const value =
        unquoteString(original);

      const position =
        stringMap.get(value);

      if (!position || !stringTableName) {
        throw new Error(
          "Constant hider: string mapping failed"
        );
      }

      return `${stringTableName}[${position}]`;
    }
  );

  /*
   * Replace number placeholders.
   */
  masked = masked.replace(
    /__LUANUM_(\d+)__/g,
    (_, index) => {
      const wantedIndex =
        Number(index);

      for (const [value, position] of numberMap) {
        if (position === wantedIndex) {
          return `${numberTableName}[${position}]`;
        }
      }

      throw new Error(
        "Constant hider: number mapping failed"
      );
    }
  );

  /*
   * Replace boolean placeholders.
   */
  masked = masked.replace(
    /__LUABOOL_(\d+)__/g,
    (_, index) => {
      const wantedIndex =
        Number(index);

      for (const [value, position] of booleanMap) {
        if (position === wantedIndex) {
          return `${booleanTableName}[${position}]`;
        }
      }

      throw new Error(
        "Constant hider: boolean mapping failed"
      );
    }
  );

  /*
   * Build header.
   */
  const header = [];

  if (stringTableName) {
    header.push(
      `local ${stringTableName} = {`
    );

    for (const [value] of stringMap) {
      header.push(
        `    "${escapeLuauString(value)}",`
      );
    }

    header.push("}");
    header.push("");
  }

  if (numberTableName) {
    header.push(
      `local ${numberTableName} = {`
    );

    for (const [value] of numberMap) {
      header.push(
        `    ${value},`
      );
    }

    header.push("}");
    header.push("");
  }

  if (booleanTableName) {
    header.push(
      `local ${booleanTableName} = {`
    );

    for (const [value] of booleanMap) {
      header.push(
        `    ${value},`
      );
    }

    header.push("}");
    header.push("");
  }

  return {
    source: masked,
    header: header.join("\n"),

    counts: {
      strings: stringMap.size,
      numbers: numberMap.size,
      booleans: booleanMap.size
    }
  };
}

module.exports = {
  hideConstants
};
