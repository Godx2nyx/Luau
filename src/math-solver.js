// math-solver.js
// Conservative Luau constant-expression solver.
// Does not execute arbitrary Luau source.

function isNumber(value) {
  return /^(?:0x[0-9a-f]+|\d+(?:\.\d+)?|\.\d+)$/i.test(value);
}

function toNumber(value) {
  if (/^0x/i.test(value)) {
    return parseInt(value, 16);
  }

  return Number(value);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (Object.is(value, -0)) {
    return "0";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return String(
    Number(value.toPrecision(15))
  );
}

function solveOperation(left, operator, right) {
  switch (operator) {
    case "+":
      return left + right;

    case "-":
      return left - right;

    case "*":
      return left * right;

    case "/":
      if (right === 0) return null;
      return left / right;

    case "%":
      if (right === 0) return null;
      return left % right;

    case "//":
      if (right === 0) return null;
      return Math.floor(left / right);

    // Bitwise AND
    case "&":
      return (left | 0) & (right | 0);

    // Bitwise OR
    case "|":
      return (left | 0) | (right | 0);

    // Bitwise XOR
    case "~":
      return (left | 0) ^ (right | 0);

    // Left shift
    case "<<":
      return (left | 0) << (right & 31);

    // Right shift
    case ">>":
      return (left | 0) >> (right & 31);

    default:
      return null;
  }
}

function foldOnce(expression) {
  const number =
    "(0x[0-9a-f]+|\\d+(?:\\.\\d+)?|\\.\\d+)";

  const operator =
    "(//|<<|>>|[+\\-*/%&|~])";

  const regex = new RegExp(
    `${number}\\s*${operator}\\s*${number}`,
    "i"
  );

  return expression.replace(
    regex,
    (full, left, op, right) => {
      if (
        !isNumber(left) ||
        !isNumber(right)
      ) {
        return full;
      }

      const a = toNumber(left);
      const b = toNumber(right);

      const result =
        solveOperation(a, op, b);

      const formatted =
        formatNumber(result);

      if (formatted === null) {
        return full;
      }

      return formatted;
    }
  );
}

function solveMath(source) {
  /*
   * Protect strings and comments.
   *
   * Example:
   * print("10 + 20")
   *
   * The "10 + 20" inside the string
   * must not be evaluated.
   */
  const protectedParts = [];

  let output = source.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--\[\[[\s\S]*?\]\]|--[^\n]*/g,
    match => {
      const id =
        `\u0001${protectedParts.length}\u0002`;

      protectedParts.push(match);

      return id;
    }
  );

  /*
   * Repeat folding so chained expressions
   * can be reduced progressively.
   *
   * Example:
   *
   * 2 * 3 + 4
   *
   * -> 6 + 4
   * -> 10
   */
  for (let i = 0; i < 8; i++) {
    const next =
      foldOnce(output);

    if (next === output) {
      break;
    }

    output = next;
  }

  /*
   * Restore strings and comments.
   */
  output = output.replace(
    /\u0001(\d+)\u0002/g,
    (_, index) => {
      return protectedParts[
        Number(index)
      ];
    }
  );

  return output;
}

module.exports = {
  solveMath
};
