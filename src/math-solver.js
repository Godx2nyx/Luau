// math-solver.js
// Conservative Luau constant-expression solver.
// Does not execute arbitrary Luau source.

function isDigit(c) {
  return c >= "0" && c <= "9";
}

function isHexDigit(c) {
  return (
    (c >= "0" && c <= "9") ||
    (c >= "a" && c <= "f") ||
    (c >= "A" && c <= "F")
  );
}

function isIdentifierChar(c) {
  return !!c && /[A-Za-z0-9_]/.test(c);
}

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

  return String(Number(value.toPrecision(15)));
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

function tokenizeExpression(expression) {
  const tokens = [];
  let i = 0;

  while (i < expression.length) {
    const c = expression[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === "(" || c === ")") {
      tokens.push({
        type: c,
        value: c
      });

      i++;
      continue;
    }

    /*
     * Hexadecimal number.
     */
    if (
      c === "0" &&
      (expression[i + 1] === "x" ||
        expression[i + 1] === "X")
    ) {
      const start = i;

      i += 2;

      const hexStart = i;

      while (
        i < expression.length &&
        isHexDigit(expression[i])
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
      isDigit(c) ||
      (c === "." && isDigit(expression[i + 1]))
    ) {
      const start = i;

      if (c === ".") {
        i++;

        while (
          i < expression.length &&
          isDigit(expression[i])
        ) {
          i++;
        }
      } else {
        while (
          i < expression.length &&
          isDigit(expression[i])
        ) {
          i++;
        }

        if (expression[i] === ".") {
          i++;

          while (
            i < expression.length &&
            isDigit(expression[i])
          ) {
            i++;
          }
        }
      }

      /*
       * Scientific notation.
       */
      if (
        expression[i] === "e" ||
        expression[i] === "E"
      ) {
        const exponentStart = i;

        i++;

        if (
          expression[i] === "+" ||
          expression[i] === "-"
        ) {
          i++;
        }

        const digitStart = i;

        while (
          i < expression.length &&
          isDigit(expression[i])
        ) {
          i++;
        }

        if (digitStart === i) {
          i = exponentStart;
        }
      }

      tokens.push({
        type: "number",
        value: expression.slice(start, i)
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
     * Anything else means this isn't a numeric-only
     * expression.
     */
    return null;
  }

  return tokens;
}

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
      let found = false;

      while (operators.length > 0) {
        const top = operators.pop();

        if (top.type === "(") {
          found = true;
          break;
        }

        output.push(top);
      }

      if (!found) {
        return null;
      }

      continue;
    }

    if (token.type === "operator") {
      while (operators.length > 0) {
        const top =
          operators[operators.length - 1];

        if (top.type !== "operator") {
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

      const right = stack.pop();
      const left = stack.pop();

      const result =
        solveOperation(
          left,
          token.value,
          right
        );

      if (
        result === null ||
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
 * Protect strings and comments.
 */
function protectSource(source) {
  const parts = [];

  let output = source.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--\[\[[\s\S]*?\]\]|--[^\n]*/g,
    match => {
      const id =
        `__LUAMATHPROTECT_${parts.length}__`;

      parts.push(match);

      return id;
    }
  );

  return {
    output,
    parts
  };
}

function restoreSource(source, parts) {
  return source.replace(
    /__LUAMATHPROTECT_(\d+)__/g,
    (_, index) => {
      return parts[Number(index)] || "";
    }
  );
}

/*
 * Find numeric expressions without using the broken
 * giant regex from the previous version.
 */
function foldNumericExpressions(source) {
  let output = source;

  /*
   * First solve parenthesized expressions.
   */
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;

    output = output.replace(
      /\(([^()]*)\)/g,
      (full, inner) => {
        const result =
          solveExpression(inner);

        if (result === null) {
          return full;
        }

        changed = true;
        return result;
      }
    );

    if (!changed) {
      break;
    }
  }

  /*
   * Find simple numeric binary expressions.
   *
   * Instead of one giant regex, scan the source.
   */
  let result = "";
  let i = 0;

  while (i < output.length) {
    const c = output[i];

    /*
     * Number start.
     */
    const numberStart =
      isDigit(c) ||
      (
        c === "." &&
        isDigit(output[i + 1])
      );

    if (!numberStart) {
      result += c;
      i++;
      continue;
    }

    /*
     * Don't touch numbers that are part of
     * identifiers or property names.
     */
    const previous =
      output[i - 1];

    if (
      isIdentifierChar(previous) ||
      previous === "."
    ) {
      result += c;
      i++;
      continue;
    }

    const start = i;

    /*
     * Read the first number.
     */
    if (
      output[i] === "0" &&
      (
        output[i + 1] === "x" ||
        output[i + 1] === "X"
      )
    ) {
      i += 2;

      while (
        i < output.length &&
        isHexDigit(output[i])
      ) {
        i++;
      }
    } else {
      if (output[i] === ".") {
        i++;

        while (
          i < output.length &&
          isDigit(output[i])
        ) {
          i++;
        }
      } else {
        while (
          i < output.length &&
          isDigit(output[i])
        ) {
          i++;
        }

        if (output[i] === ".") {
          i++;

          while (
            i < output.length &&
            isDigit(output[i])
          ) {
            i++;
          }
        }
      }
    }

    /*
     * Read expression around the number.
     *
     * Keep this conservative: only continue if an
     * operator and another numeric literal follow.
     */
    let end = i;

    while (true) {
      const operatorStart = end;

      while (
        end < output.length &&
        /\s/.test(output[end])
      ) {
        end++;
      }

      const two =
        output.slice(end, end + 2);

      let operator = null;

      if (
        two === "//" ||
        two === "<<" ||
        two === ">>"
      ) {
        operator = two;
        end += 2;
      } else if (
        output[end] === "+" ||
        output[end] === "-" ||
        output[end] === "*" ||
        output[end] === "/" ||
        output[end] === "%" ||
        output[end] === "&" ||
        output[end] === "|" ||
        output[end] === "~"
      ) {
        operator = output[end];
        end++;
      }

      if (!operator) {
        end = operatorStart;
        break;
      }

      while (
        end < output.length &&
        /\s/.test(output[end])
      ) {
        end++;
      }

      /*
       * Require another number.
       */
      if (
        !isDigit(output[end]) &&
        !(
          output[end] === "." &&
          isDigit(output[end + 1])
        ) &&
        !(
          output[end] === "0" &&
          (
            output[end + 1] === "x" ||
            output[end + 1] === "X"
          )
        )
      ) {
        end = operatorStart;
        break;
      }

      /*
       * Consume second number.
       */
      if (
        output[end] === "0" &&
        (
          output[end + 1] === "x" ||
          output[end + 1] === "X"
        )
      ) {
        end += 2;

        while (
          end < output.length &&
          isHexDigit(output[end])
        ) {
          end++;
        }
      } else if (
        output[end] === "."
      ) {
        end++;

        while (
          end < output.length &&
          isDigit(output[end])
        ) {
          end++;
        }
      } else {
        while (
          end < output.length &&
          isDigit(output[end])
        ) {
          end++;
        }

        if (output[end] === ".") {
          end++;

          while (
            end < output.length &&
            isDigit(output[end])
          ) {
            end++;
          }
        }
      }
    }

    const expression =
      output.slice(start, end);

    const solved =
      solveExpression(expression);

    if (solved !== null) {
      result += solved;
      i = end;
    } else {
      result += output.slice(start, i);
      i = i;
    }
  }

  return result;
}

function solveMath(source) {
  if (
    typeof source !== "string" ||
    source.length === 0
  ) {
    return source;
  }

  const protectedSource =
    protectSource(source);

  let output =
    protectedSource.output;

  /*
   * Run a few conservative passes.
   */
  for (let i = 0; i < 8; i++) {
    const next =
      foldNumericExpressions(output);

    if (next === output) {
      break;
    }

    output = next;
  }

  /*
   * Restore original strings/comments.
   */
  output =
    restoreSource(
      output,
      protectedSource.parts
    );

  /*
   * Safety check:
   * the math solver must never emit the old
   * control-character placeholders.
   */
  output =
    output.replace(
      /[\x01\x02\x03\x04]/g,
      ""
    );

  return output;
}

module.exports = {
  solveMath,
  solveExpression,
  isNumber
};
