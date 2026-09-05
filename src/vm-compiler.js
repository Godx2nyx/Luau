// vm-compiler.js

function compileSimple(source) {
  const constants = [];
  const instructions = [];

  function constant(value) {
    const index = constants.findIndex(
      item =>
        typeof item === typeof value &&
        item === value
    );

    if (index !== -1) {
      return index;
    }

    constants.push(value);

    return constants.length - 1;
  }

  function loadConstant(register, value) {
    instructions.push({
      op: "LOADK",
      a: register,
      b: constant(value)
    });
  }

  /*
   * This compiler intentionally handles only
   * simple local assignments.
   *
   * Example:
   *
   * local a = 10
   * local b = 20
   * local c = a + b
   */
  const lines =
    source
      .replace(/\r\n?/g, "\n")
      .split("\n");

  const registers = new Map();
  let nextRegister = 0;

  function getRegister(name) {
    if (!registers.has(name)) {
      registers.set(
        name,
        nextRegister++
      );
    }

    return registers.get(name);
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const match =
      line.match(
        /^local\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/
      );

    if (!match) {
      continue;
    }

    const name = match[1];
    const expression = match[2].trim();

    const target =
      getRegister(name);

    /*
     * Number
     */
    if (
      /^(?:0x[0-9a-f]+|\d+(?:\.\d+)?)$/i
        .test(expression)
    ) {
      const value =
        /^0x/i.test(expression)
          ? parseInt(expression, 16)
          : Number(expression);

      loadConstant(
        target,
        value
      );

      continue;
    }

    /*
     * String
     */
    if (
      /^"(?:\\.|[^"\\])*"$/.test(expression) ||
      /^'(?:\\.|[^'\\])*'$/.test(expression)
    ) {
      loadConstant(
        target,
        expression
      );

      continue;
    }

    /*
     * Boolean
     */
    if (
      expression === "true" ||
      expression === "false"
    ) {
      loadConstant(
        target,
        expression === "true"
      );

      continue;
    }

    /*
     * Binary arithmetic.
     */
    const binary =
      expression.match(
        /^([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)\s*([+\-*\/%])\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)$/
      );

    if (binary) {
      const left = binary[1];
      const operator = binary[2];
      const right = binary[3];

      let leftRegister;

      if (
        /^[A-Za-z_]/.test(left)
      ) {
        leftRegister =
          getRegister(left);
      } else {
        leftRegister = nextRegister++;

        loadConstant(
          leftRegister,
          Number(left)
        );
      }

      let rightRegister;

      if (
        /^[A-Za-z_]/.test(right)
      ) {
        rightRegister =
          getRegister(right);
      } else {
        rightRegister = nextRegister++;

        loadConstant(
          rightRegister,
          Number(right)
        );
      }

      const opcode = {
        "+": "ADD",
        "-": "SUB",
        "*": "MUL",
        "/": "DIV",
        "%": "MOD"
      }[operator];

      instructions.push({
        op: opcode,
        a: target,
        b: leftRegister,
        c: rightRegister
      });
    }
  }

  instructions.push({
    op: "HALT"
  });

  return {
    constants,
    registers: nextRegister,
    instructions
  };
}

module.exports = {
  compileSimple
};
