import { BaseCell, type DatabaseExtremeValueCell } from "./BaseCell";
import { MathField } from "./MathField.svelte";
import type { Statement } from "../parser/types";
import { defaultConfig, type NumberFormatOptions } from "../sheet/Sheet";

const MAX_PARAMETERS = 20;

export default class ExtremeValueCell extends BaseCell {
  parameterFields: MathField[] = $state();
  minFields: MathField[] = $state();
  maxFields: MathField[] = $state();
  queryField: MathField = $state();
  formatOptions: NumberFormatOptions | null = $state(null);

  // Internal fields for building "param = min_value" / "param = max_value" assignment statements
  combinedMinFields: MathField[];
  combinedMaxFields: MathField[];

  minStatements: Statement[];
  maxStatements: Statement[];

  constructor(arg?: DatabaseExtremeValueCell) {
    super("extremeValue", arg?.id);
    if (arg === undefined) {
      this.parameterFields = [new MathField('', 'parameter')];
      this.minFields = [new MathField('', 'number')];
      this.maxFields = [new MathField('', 'number')];
      this.queryField = new MathField('', 'math');
      this.combinedMinFields = [new MathField()];
      this.combinedMaxFields = [new MathField()];
      this.minStatements = [];
      this.maxStatements = [];
      this.formatOptions = null;
    } else {
      this.parameterFields = arg.parameterLatexs.map((latex) => new MathField(latex, 'parameter'));
      this.minFields = arg.minLatexs.map((latex) => new MathField(latex, 'number'));
      this.maxFields = arg.maxLatexs.map((latex) => new MathField(latex, 'number'));
      this.queryField = new MathField(arg.queryLatex, 'math');
      this.combinedMinFields = arg.parameterLatexs.map(() => new MathField());
      this.combinedMaxFields = arg.parameterLatexs.map(() => new MathField());
      this.minStatements = [];
      this.maxStatements = [];
      this.formatOptions = arg.formatOptions ?? null;
    }
  }

  serialize(): DatabaseExtremeValueCell {
    return {
      type: "extremeValue",
      id: this.id,
      parameterLatexs: this.parameterFields.map((f) => f.latex),
      minLatexs: this.minFields.map((f) => f.latex),
      maxLatexs: this.maxFields.map((f) => f.latex),
      queryLatex: this.queryField.latex,
      formatOptions: this.formatOptions,
    };
  }

  get parsePending() {
    return this.queryField.parsePending ||
           this.parameterFields.some((f) => f.parsePending) ||
           this.minFields.some((f) => f.parsePending) ||
           this.maxFields.some((f) => f.parsePending);
  }

  get canAddRow(): boolean {
    return this.parameterFields.length < MAX_PARAMETERS;
  }

  async parseExtremeValueStatements() {
    const newMinStatements: Statement[] = [];
    const newMaxStatements: Statement[] = [];

    const hasParsingErrors =
      this.parameterFields.some((f) => f.parsingError) ||
      this.minFields.some((f) => f.parsingError) ||
      this.maxFields.some((f) => f.parsingError);

    if (!hasParsingErrors) {
      for (let i = 0; i < this.parameterFields.length; i++) {
        const paramLatex = this.parameterFields[i].latex;
        const minLatex = this.minFields[i].latex;
        const maxLatex = this.maxFields[i].latex;

        // Skip rows where parameter or both min/max are empty
        if (paramLatex.replaceAll(/\\:?/g, '').trim() === '') continue;
        if (minLatex.replaceAll(/\\:?/g, '').trim() === '' &&
            maxLatex.replaceAll(/\\:?/g, '').trim() === '') continue;

        // Build "param = min_value" and "param = max_value" combined LaTeX
        if (minLatex.replaceAll(/\\:?/g, '').trim() !== '') {
          const combinedMinLatex = paramLatex + "=" + minLatex;
          await this.combinedMinFields[i].parseLatex(combinedMinLatex);
          newMinStatements.push(this.combinedMinFields[i].statement);
        }

        if (maxLatex.replaceAll(/\\:?/g, '').trim() !== '') {
          const combinedMaxLatex = paramLatex + "=" + maxLatex;
          await this.combinedMaxFields[i].parseLatex(combinedMaxLatex);
          newMaxStatements.push(this.combinedMaxFields[i].statement);
        }
      }
    }

    this.minStatements = newMinStatements;
    this.maxStatements = newMaxStatements;
  }

  addRow() {
    if (!this.canAddRow) return;
    this.parameterFields = [...this.parameterFields, new MathField('', 'parameter')];
    this.minFields = [...this.minFields, new MathField('', 'number')];
    this.maxFields = [...this.maxFields, new MathField('', 'number')];
    this.combinedMinFields = [...this.combinedMinFields, new MathField()];
    this.combinedMaxFields = [...this.combinedMaxFields, new MathField()];
  }

  deleteRow(rowIndex: number) {
    if (this.parameterFields.length <= 1) return;
    this.parameterFields = [...this.parameterFields.slice(0, rowIndex), ...this.parameterFields.slice(rowIndex + 1)];
    this.minFields = [...this.minFields.slice(0, rowIndex), ...this.minFields.slice(rowIndex + 1)];
    this.maxFields = [...this.maxFields.slice(0, rowIndex), ...this.maxFields.slice(rowIndex + 1)];
    this.combinedMinFields = [...this.combinedMinFields.slice(0, rowIndex), ...this.combinedMinFields.slice(rowIndex + 1)];
    this.combinedMaxFields = [...this.combinedMaxFields.slice(0, rowIndex), ...this.combinedMaxFields.slice(rowIndex + 1)];
  }
}
