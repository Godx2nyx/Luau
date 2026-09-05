// vm.js
// Safe register-based Luau VM core.
//
// This VM is intentionally limited to arithmetic,
// constants, moves and printing. It does not execute
// arbitrary JavaScript or dynamically evaluate source.

class VM {
  constructor(bytecode, constants = []) {
    this.code = bytecode || [];
    this.constants = constants || [];

    this.registers = [];
    this.pc = 0;
    this.running = true;
  }

  getRegister(index) {
    return this.registers[index];
  }

  setRegister(index, value) {
    this.registers[index] = value;
  }

  getConstant(index) {
    return this.constants[index];
  }

  run() {
    while (
      this.running &&
      this.pc >= 0 &&
      this.pc < this.code.length
    ) {
      const instruction = this.code[this.pc];

      if (!instruction) {
        throw new Error(
          `Invalid instruction at ${this.pc}`
        );
      }

      this.dispatch(instruction);
    }

    return this.registers;
  }

  dispatch(ins) {
    switch (ins.op) {
      case "LOADK":
        this.setRegister(
          ins.a,
          this.getConstant(ins.b)
        );

        this.pc++;
        break;

      case "MOVE":
        this.setRegister(
          ins.a,
          this.getRegister(ins.b)
        );

        this.pc++;
        break;

      case "ADD":
        this.setRegister(
          ins.a,
          this.getRegister(ins.b) +
          this.getRegister(ins.c)
        );

        this.pc++;
        break;

      case "SUB":
        this.setRegister(
          ins.a,
          this.getRegister(ins.b) -
          this.getRegister(ins.c)
        );

        this.pc++;
        break;

      case "MUL":
        this.setRegister(
          ins.a,
          this.getRegister(ins.b) *
          this.getRegister(ins.c)
        );

        this.pc++;
        break;

      case "DIV":
        if (this.getRegister(ins.c) === 0) {
          throw new Error(
            "VM division by zero"
          );
        }

        this.setRegister(
          ins.a,
          this.getRegister(ins.b) /
          this.getRegister(ins.c)
        );

        this.pc++;
        break;

      case "MOD":
        if (this.getRegister(ins.c) === 0) {
          throw new Error(
            "VM modulo by zero"
          );
        }

        this.setRegister(
          ins.a,
          this.getRegister(ins.b) %
          this.getRegister(ins.c)
        );

        this.pc++;
        break;

      case "NEG":
        this.setRegister(
          ins.a,
          -this.getRegister(ins.b)
        );

        this.pc++;
        break;

      case "PRINT":
        console.log(
          this.getRegister(ins.a)
        );

        this.pc++;
        break;

      case "JMP":
        this.pc = ins.target;
        break;

      case "JMP_IF":
        if (this.getRegister(ins.a)) {
          this.pc = ins.target;
        } else {
          this.pc++;
        }

        break;

      case "HALT":
        this.running = false;
        break;

      default:
        throw new Error(
          `Unknown VM opcode: ${String(ins.op)}`
        );
    }
  }
}

module.exports = {
  VM
};
