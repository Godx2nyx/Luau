// math-solver.js
// Conservative Luau constant-expression solver.
// Does NOT execute arbitrary Luau source.
// Only folds expressions consisting entirely of numeric literals
// and supported arithmetic / bitwise operators.

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

  const result = Number(
    value.toPrecision(15)
  );

  if (!Number.isFinite(result)) {
    return null;
  }

  return String(result);
}

/*
 * Apply one binary operation.
 *
 * Returns null when the operation should not be folded.
 */
function solveOperation(left, operator, right) {
  if (
    !Number.isFinite(left) ||
    !Number.isFinite(right)
  ) {
    return null;
  }

  switch (operator) {
    case "+":
      return left + right;

    case "-":
      return left - right;

    case "*":
      return left * right;

    case "/":
      if (right === 0) {
        return null;
      }

      return left / right;

    case "%":
      if (right === 0) {
        return null;
      }

      return left % right;

    case "//":
      if (right === 0) {
        return null;
      }

      return Math.floor(left / right);

    /*
     * Luau bitwise operators work on integers.
     */
    case "&":
      if (
        !Number.isInteger(left) ||
        !Number.isInteger(right)
      ) {
        return null;
      }

      return (left | 0) & (right | 0);

    case "|":
      if (
        !Number.isInteger(left) ||
        !Number.isInteger(right)
      ) {
        return null;
      }

      return (left | 0) | (right | 0);

    case "~":
      if (
        !Number.isInteger(left) ||
        !Number.isInteger(right)
      ) {
        return null;
      }

      return (left | 0) ^ (right | 0);

    case "<<":
      if (
        !Number.isInteger(left) ||
        !Number.isInteger(right)
      ) {
        return null;
      }

      return (left | 0) << (right & 31);

    case ">>":
      if (
        !Number.isInteger(left) ||
        !Number.isInteger(right)
      ) {
        return null;
      }

      return (left | 0) >> (right & 31);

    default:
      return null;
  }
}

/*
 * Operator precedence.
 *
 * Higher number = tighter binding.
 */
const PRECEDENCE = {
  "|": 1,
  "~": 2,
  "&": 3,

  "<<": 4,
  ">>": 4,

  "+": 5,
  "-": 5,

  "*": 6,
  "/": 6,
  "%": 6,
  "//": 6
};

function isOperator(value) {
  return Object.prototype.hasOwnProperty.call(
    PRECEDENCE,
    value
  );
}

/*
 * Tokenize a numeric-only expression.
 *
 * This is intentionally strict.
 *
 * Example accepted:
 *
 *   2 + 3 * 4
 *   100 // 3
 *   10 << 2
 *
 * Example rejected:
 *
 *   foo + 2
 *   game:GetService(...)
 *   "hello" + 2
 */
function tokenizeExpression(expression) {
  const tokens = [];
  let i = 0;

  while (i < expression.length) {
    const c = expression[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    /*
     * Parentheses.
     */
    if (c === "(" || c === ")") {
      tokens.push({
        type: c,
        value: c
      });

      i++;
      continue;
    }

    /*
     * Hex number.
     */
    if (
      c === "0" &&
      /[xX]/.test(expression[i + 1] || "")
    ) {
      const start = i;

      i += 2;

      const hexStart = i;

      while (
        i < expression.length &&
        /[0-9a-fA-F]/.test(expression[i])
      ) {
        i++;
      }

      if (i === hexStart) {
        return null;
      }

      tokens.push({
        type: "number",
        value: expression.slice(start, i)
      });

      continue;
    }

    /*
     * Decimal number.
     */
    if (
      /[0-9]/.test(c) ||
      (
        c === "." &&
        /[0-9]/.test(expression[i + 1] || "")
      )
    ) {
      const start = i;

      let hasDot = false;

      if (c === ".") {
        hasDot = true;
        i++;
      }

      while (
        i < expression.length &&
        /[0-9]/.test(expression[i])
      ) {
        i++;
      }

      if (
        !hasDot &&
        expression[i] === "."
      ) {
        hasDot = true;
        i++;

        while (
          i < expression.length &&
          /[0-9]/.test(expression[i])
        ) {
          i++;
        }
      }

      /*
       * Scientific notation.
       */
      if (
        expression[i] === "e" ||
        expression[i] === "E"
      ) {
        i++;

        if (
          expression[i] === "+" ||
          expression[i] === "-"
        ) {
          i++;
        }

        const exponentStart = i;

        while (
          i < expression.length &&
          /[0-9]/.test(expression[i])
        ) {
          i++;
        }

        if (i === exponentStart) {
          return null;
        }
      }

      const value =
        expression.slice(start, i);

      /*
       * Keep solver conservative.
       */
      if (
        !/^(?:0x[0-9a-f]+|\d+(?:\.\d+)?|\.\d+(?:[eE][+-]?\d+)?|\d+(?:[eE][+-]?\d+))$/i.test(
          value
        )
      ) {
        return null;
      }

      tokens.push({
        type: "number",
        value
      });

      continue;
    }

    /*
     * Two-character operators.
     */
    const two =
      expression.slice(i, i + 2);

    if (
      two === "//" ||
      two === "<<" ||
      two === ">>"
    ) {
      tokens.push({
        type: "operator",
        value: two
      });

      i += 2;
      continue;
    }

    /*
     * Single-character operators.
     */
    if (
      c === "+" ||
      c === "-" ||
      c === "*" ||
      c === "/" ||
      c === "%" ||
      c === "&" ||
      c === "|" ||
      c === "~"
    ) {
      tokens.push({
        type: "operator",
        value: c
      });

      i++;
      continue;
    }

    /*
     * Anything else means this is not
     * a safe constant expression.
     */
    return null;
  }

  return tokens;
}

/*
 * Convert infix expression to postfix using
 * the Shunting-Yard algorithm.
 */
function toPostfix(tokens) {
  const output = [];
  const operators = [];

  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token);
      continue;
    }

    if (token.type === "(") {
      operators.push(token);
      continue;
    }

    if (token.type === ")") {
      let foundOpening = false;

      while (operators.length > 0) {
        const top = operators.pop();

        if (top.type === "(") {
          foundOpening = true;
          break;
        }

        output.push(top);
      }

      if (!foundOpening) {
        return null;
      }

      continue;
    }

    if (token.type === "operator") {
      while (operators.length > 0) {
        const top =
          operators[operators.length - 1];

        if (
          top.type !== "operator"
        ) {
          break;
        }

        if (
          PRECEDENCE[top.value] >=
          PRECEDENCE[token.value]
        ) {
          output.push(
            operators.pop()
          );
        } else {
          break;
        }
      }

      operators.push(token);
      continue;
    }

    return null;
  }

  while (operators.length > 0) {
    const top = operators.pop();

    if (
      top.type === "(" ||
      top.type === ")"
    ) {
      return null;
    }

    output.push(top);
  }

  return output;
}

/*
 * Evaluate postfix expression.
 *
 * This does NOT execute Lua/Luau code.
 * It only operates on numbers already parsed
 * from the expression.
 */
function evaluatePostfix(tokens) {
  const stack = [];

  for (const token of tokens) {
    if (token.type === "number") {
      const value =
        toNumber(token.value);

      if (!Number.isFinite(value)) {
        return null;
      }

      stack.push(value);
      continue;
    }

    if (token.type === "operator") {
      if (stack.length < 2) {
        return null;
      }

      const right =
        stack.pop();

      const left =
        stack.pop();

      const result =
        solveOperation(
          left,
          token.value,
          right
        );

      if (result === null) {
        return null;
      }

      if (
        !Number.isFinite(result)
      ) {
        return null;
      }

      stack.push(result);
      continue;
    }

    return null;
  }

  if (stack.length !== 1) {
    return null;
  }

  return stack[0];
}

/*
 * Try to completely solve an expression.
 */
function solveExpression(expression) {
  const tokens =
    tokenizeExpression(expression);

  if (!tokens || tokens.length === 0) {
    return null;
  }

  const postfix =
    toPostfix(tokens);

  if (!postfix) {
    return null;
  }

  const result =
    evaluatePostfix(postfix);

  if (result === null) {
    return null;
  }

  return formatNumber(result);
}

/*
 * Find and fold numeric expressions inside source.
 *
 * Strings and comments are protected with SAFE
 * textual placeholders. No control characters
 * are ever inserted into the source.
 */
function solveMath(source) {
  if (
    typeof source !== "string" ||
    source.length === 0
  ) {
    return source;
  }

  const protectedParts = [];

  function protect(match) {
    const id =
      `__LUAMATHPROTECT_${protectedParts.length}__`;

    protectedParts.push(match);

    return id;
  }

  /*
   * Protect:
   * - double quoted strings
   * - single quoted strings
   * - multiline comments
   * - single line comments
   */
  let output = source.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--\[\[[\s\S]*?\]\]|--[^\n]*/g,
    protect
  );

  /*
   * Protect identifiers temporarily.
   *
   * This prevents the solver from accidentally
   * treating a number inside an identifier as
   * part of an expression.
   */
  output = output.replace(
    /[A-Za-z_][A-Za-z0-9_]*/g,
    match => {
      const id =
        `__LUAMATHIDENT_${protectedParts.length}__`;

      protectedParts.push(match);

      return id;
    }
  );

  /*
   * Fold parenthesized numeric expressions first.
   *
   * Example:
   *
   * (2 + 3) * 4
   *
   * -> 5 * 4
   * -> 20
   */
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;

    /*
     * Innermost parentheses.
     */
    output = output.replace(
      /\(([^()]*)\)/g,
      (full, inner) => {
        const solved =
          solveExpression(inner);

        if (solved === null) {
          return full;
        }

        changed = true;

        return solved;
      }
    );

    /*
     * Plain numeric expression.
     *
     * Require boundaries so this cannot eat
     * pieces of generated identifiers.
     */
    output = output.replace(
      /(?<![A-Za-z0-9_.$])(?:0x[0-9a-f]+|\d+(?:\.\d+)?|\.\d+)(?:\s*(?://|<<|>>|[+\-*/%&|~])\s*(?:0x[0-9a-f]+|\d+(?:\.\d+)?|\.\d+))+(?![A-Za-z0-9_.$])/gi,
      match => {
        const solved =
          solveExpression(match);

        if (solved === null) {
          return match;
        }

        changed = true;

        return solved;
      }
    );

    if (!changed) {
      break;
    }
  }

  /*
   * Restore protected identifiers.
   *
   * We stored identifiers after strings/comments,
   * so their indices are all in the same array.
   */
  output = output.replace(
    /__LUAMATHIDENT_(\d+)__/g,
    (_, index) => {
      return protectedParts[
        Number(index)
      ];
    }
  );

  /*
   * Restore strings/comments.
   */
  output = output.replace(
    /__LUAMATHPROTECT_(\d+)__/g,
    (_, index) => {
      return protectedParts[
        Number(index)
      ];
    }
  );

  return output;
}

module.exports = {
  solveMath,
  solveExpression
};
