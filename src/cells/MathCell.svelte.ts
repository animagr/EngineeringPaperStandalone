import type { MathCellConfig } from "../sheet/Sheet";
import { BaseCell, type DatabaseMathCell } from "./BaseCell";
import { MathField } from "./MathField.svelte";

export default class MathCell extends BaseCell {
  mathField: MathField = $state();
  config: MathCellConfig | null = $state();
  annotation: string = $state("");

  constructor (arg?: DatabaseMathCell) {
    super("math", arg?.id);
    if (arg === undefined) {
      this.mathField = new MathField("");
      this.config = null;
    } else {
      this.annotation = arg.annotation ?? "";
      this.mathField = new MathField(arg.latex);
      if (arg.config) {
        this.config = arg.config;
        if (this.config.showIntermediateResults === undefined) {
          this.config.showIntermediateResults = false;
        }
      } else {
        this.config = null;        
      }
    }
  } 

  serialize(): DatabaseMathCell {
    const result: DatabaseMathCell = {
      type: "math",
      id: this.id,
      latex: this.mathField.latex,
      config: this.config
    };
    if (this.annotation) {
      result.annotation = this.annotation;
    }
    return result;
  }

  get parsePending() {
    return this.mathField.parsePending;
  }
}