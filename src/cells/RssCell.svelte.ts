import { BaseCell, type DatabaseRssCell } from "./BaseCell";
import { MathField } from "./MathField.svelte";
import type { Statement } from "../parser/types";
import { defaultConfig, type NumberFormatOptions } from "../sheet/Sheet";

const MAX_PARAMETERS = 20;

export default class RssCell extends BaseCell {
  parameterFields: MathField[] = $state();
  minFields: MathField[] = $state();
  nominalFields: MathField[] = $state();
  maxFields: MathField[] = $state();
  queryField: MathField = $state();
  formatOptions: NumberFormatOptions | null = $state(null);

  combinedMinFields: MathField[];
  combinedNominalFields: MathField[];
  combinedMaxFields: MathField[];

  minStatements: Statement[];
  nominalStatements: Statement[];
  maxStatements: Statement[];

  constructor(arg?: DatabaseRssCell) {
    super("rss", arg?.id);
    if (arg === undefined) {
      this.parameterFields = [new MathField('', 'parameter')];
      this.minFields = [new MathField('', 'number')];
      this.nominalFields = [new MathField('', 'number')];
      this.maxFields = [new MathField('', 'number')];
      this.queryField = new MathField('', 'math');
      this.combinedMinFields = [new MathField()];
      this.combinedNominalFields = [new MathField()];
      this.combinedMaxFields = [new MathField()];
      this.minStatements = [];
      this.nominalStatements = [];
      this.maxStatements = [];
      this.formatOptions = null;
    } else {
      this.parameterFields = arg.parameterLatexs.map((latex) => new MathField(latex, 'parameter'));
      this.minFields = arg.minLatexs.map((latex) => new MathField(latex, 'number'));
      this.nominalFields = arg.nominalLatexs.map((latex) => new MathField(latex, 'number'));
      this.maxFields = arg.maxLatexs.map((latex) => new MathField(latex, 'number'));
      this.queryField = new MathField(arg.queryLatex, 'math');
      this.combinedMinFields = arg.parameterLatexs.map(() => new MathField());
      this.combinedNominalFields = arg.parameterLatexs.map(() => new MathField());
      this.combinedMaxFields = arg.parameterLatexs.map(() => new MathField());
      this.minStatements = [];
      this.nominalStatements = [];
      this.maxStatements = [];
      this.formatOptions = arg.formatOptions ?? null;
    }
  }

  serialize(): DatabaseRssCell {
    return {
      type: "rss",
      id: this.id,
      parameterLatexs: this.parameterFields.map((f) => f.latex),
      minLatexs: this.minFields.map((f) => f.latex),
      nominalLatexs: this.nominalFields.map((f) => f.latex),
      maxLatexs: this.maxFields.map((f) => f.latex),
      queryLatex: this.queryField.latex,
      formatOptions: this.formatOptions,
    };
  }

  get parsePending() {
    return this.queryField.parsePending ||
           this.parameterFields.some((f) => f.parsePending) ||
           this.minFields.some((f) => f.parsePending) ||
           this.nominalFields.some((f) => f.parsePending) ||
           this.maxFields.some((f) => f.parsePending);
  }

  get canAddRow(): boolean {
    return this.parameterFields.length < MAX_PARAMETERS;
  }

  async parseRssStatements() {
    const newMinStatements: Statement[] = [];
    const newNominalStatements: Statement[] = [];
    const newMaxStatements: Statement[] = [];

    const hasParsingErrors =
      this.parameterFields.some((f) => f.parsingError) ||
      this.minFields.some((f) => f.parsingError) ||
      this.nominalFields.some((f) => f.parsingError) ||
      this.maxFields.some((f) => f.parsingError);

    if (!hasParsingErrors) {
      for (let i = 0; i < this.parameterFields.length; i++) {
        const paramLatex = this.parameterFields[i].latex;
        const minLatex = this.minFields[i].latex;
        const nominalLatex = this.nominalFields[i].latex;
        const maxLatex = this.maxFields[i].latex;

        if (paramLatex.replaceAll(/\\:?/g, '').trim() === '') continue;
        if (minLatex.replaceAll(/\\:?/g, '').trim() === '' &&
            nominalLatex.replaceAll(/\\:?/g, '').trim() === '' &&
            maxLatex.replaceAll(/\\:?/g, '').trim() === '') continue;

        if (minLatex.replaceAll(/\\:?/g, '').trim() !== '') {
          const combinedMinLatex = paramLatex + "=" + minLatex;
          await this.combinedMinFields[i].parseLatex(combinedMinLatex);
          newMinStatements.push(this.combinedMinFields[i].statement);
        }

        if (nominalLatex.replaceAll(/\\:?/g, '').trim() !== '') {
          const combinedNominalLatex = paramLatex + "=" + nominalLatex;
          await this.combinedNominalFields[i].parseLatex(combinedNominalLatex);
          newNominalStatements.push(this.combinedNominalFields[i].statement);
        }

        if (maxLatex.replaceAll(/\\:?/g, '').trim() !== '') {
          const combinedMaxLatex = paramLatex + "=" + maxLatex;
          await this.combinedMaxFields[i].parseLatex(combinedMaxLatex);
          newMaxStatements.push(this.combinedMaxFields[i].statement);
        }
      }
    }

    this.minStatements = newMinStatements;
    this.nominalStatements = newNominalStatements;
    this.maxStatements = newMaxStatements;
  }

  addRow() {
    if (!this.canAddRow) return;
    this.parameterFields = [...this.parameterFields, new MathField('', 'parameter')];
    this.minFields = [...this.minFields, new MathField('', 'number')];
    this.nominalFields = [...this.nominalFields, new MathField('', 'number')];
    this.maxFields = [...this.maxFields, new MathField('', 'number')];
    this.combinedMinFields = [...this.combinedMinFields, new MathField()];
    this.combinedNominalFields = [...this.combinedNominalFields, new MathField()];
    this.combinedMaxFields = [...this.combinedMaxFields, new MathField()];
  }

  deleteRow(rowIndex: number) {
    if (this.parameterFields.length <= 1) return;
    this.parameterFields = [...this.parameterFields.slice(0, rowIndex), ...this.parameterFields.slice(rowIndex + 1)];
    this.minFields = [...this.minFields.slice(0, rowIndex), ...this.minFields.slice(rowIndex + 1)];
    this.nominalFields = [...this.nominalFields.slice(0, rowIndex), ...this.nominalFields.slice(rowIndex + 1)];
    this.maxFields = [...this.maxFields.slice(0, rowIndex), ...this.maxFields.slice(rowIndex + 1)];
    this.combinedMinFields = [...this.combinedMinFields.slice(0, rowIndex), ...this.combinedMinFields.slice(rowIndex + 1)];
    this.combinedNominalFields = [...this.combinedNominalFields.slice(0, rowIndex), ...this.combinedNominalFields.slice(rowIndex + 1)];
    this.combinedMaxFields = [...this.combinedMaxFields.slice(0, rowIndex), ...this.combinedMaxFields.slice(rowIndex + 1)];
  }
}
