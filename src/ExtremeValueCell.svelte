<script lang="ts">
  import { bignumber, format, type BigNumber, type FormatOptions } from "mathjs";
  import appState from "./stores.svelte";
  import { isExtremeValueResult, isFiniteImagResult, type Result, type FiniteImagResult } from "./resultTypes";
  import { defaultConfig, type NumberFormatOptions } from "./sheet/Sheet";

  import type ExtremeValueCell from "./cells/ExtremeValueCell.svelte";

  import MathField from "./MathField.svelte";
  import IconButton from "./IconButton.svelte";
  import NumberFormatOptionsDialog from "./NumberFormatOptionsDialog.svelte";

  import { TooltipIcon, Modal } from "carbon-components-svelte";
  import Error from "carbon-icons-svelte/lib/Error.svelte";
  import Add from "carbon-icons-svelte/lib/Add.svelte";
  import RowDelete from "carbon-icons-svelte/lib/RowDelete.svelte";
  import SettingsAdjust from "carbon-icons-svelte/lib/SettingsAdjust.svelte";

  interface Props {
    index: number;
    extremeValueCell: ExtremeValueCell;
    insertMathCellAfter: (arg: {detail: {index: number}}) => void;
    insertInsertCellAfter: (arg: {detail: {index: number}}) => void;
    mathCellChanged: () => void;
    triggerSaveNeeded: (pendingMathCellChange?: boolean) => void;
  }

  let {
    index,
    extremeValueCell,
    insertMathCellAfter,
    insertInsertCellAfter,
    mathCellChanged,
    triggerSaveNeeded
  }: Props = $props();

  let numRows = $derived(extremeValueCell.parameterFields.length);

  let result = $derived(appState.results[index]);
  let evaResult = $derived(result && !Array.isArray(result) && isExtremeValueResult(result) ? result : null);

  let formatOptionsOpen = $state(false);
  let formatOptionsDialogRef: NumberFormatOptionsDialog;

  // Get format options (use cell's options or default)
  let formatOptions = $derived(extremeValueCell.formatOptions ?? defaultConfig.mathCellConfig.formatOptions);

  function scientificToLatex(value: string): string {
    if (value.includes('e')) {
      return value.replace('e', '\\times 10^{').replace('+', '') + '}';
    } else {
      return value;
    }
  }

  function customFormat(input: BigNumber, options: FormatOptions): string {
    return scientificToLatex(format(input, options));
  }

  function formatResultValue(resultObj: Result | FiniteImagResult): string {
    if (isFiniteImagResult(resultObj)) {
      // For complex numbers, just show the raw value for now
      return resultObj.value;
    }
    // Check if it's a numeric value that can be formatted
    const numValue = parseFloat(resultObj.value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return customFormat(bignumber(resultObj.value), formatOptions);
    }
    // Fallback for symbolic/non-numeric values
    return resultObj.symbolicValue ?? resultObj.value;
  }

  function openFormatOptions() {
    formatOptionsOpen = true;
  }

  function handleFormatOptionsChange(newOptions: NumberFormatOptions | null) {
    extremeValueCell.formatOptions = newOptions;
    triggerSaveNeeded();
  }

  function closeFormatOptions() {
    formatOptionsOpen = false;
  }

  export function getMarkdown(centerEquations: boolean) {
    let md = "";
    let startDelimiter: string;
    let endDelimiter: string;
    if (centerEquations) {
      startDelimiter = "$$ ";
      endDelimiter = " $$";
    } else {
      startDelimiter = "$";
      endDelimiter = "$ <!-- inline -->";
    }

    md += "**Extreme Value Analysis**\n\n";

    // Query
    if (extremeValueCell.queryField.latex) {
      md += `Query: ${startDelimiter}${extremeValueCell.queryField.latex}${endDelimiter}\n\n`;
    }

    // Parameter table
    md += "| Parameter | Min | Max |\n";
    md += "|-----------|-----|-----|\n";
    for (let i = 0; i < extremeValueCell.parameterFields.length; i++) {
      const param = extremeValueCell.parameterFields[i].latex || "";
      const min = extremeValueCell.minFields[i].latex || "";
      const max = extremeValueCell.maxFields[i].latex || "";
      md += `| ${startDelimiter}${param}${endDelimiter} | ${startDelimiter}${min}${endDelimiter} | ${startDelimiter}${max}${endDelimiter} |\n`;
    }
    md += "\n";

    // Results
    if (evaResult) {
      if (evaResult.error) {
        md += `Error: ${evaResult.error}\n\n`;
      } else {
        md += `Min: ${startDelimiter}${formatResultValue(evaResult.minResult)} ${evaResult.minResult.unitsLatex}${endDelimiter}\n\n`;
        md += `Max: ${startDelimiter}${formatResultValue(evaResult.maxResult)} ${evaResult.maxResult.unitsLatex}${endDelimiter}\n\n`;
        if (evaResult.sensitivity && evaResult.sensitivity.length > 0) {
          md += `**Sensitivity:**\n`;
          for (const entry of evaResult.sensitivity) {
            md += `- ${entry.paramName}: ${entry.percentage.toFixed(1)}%\n`;
          }
          md += `\n`;
        }
      }
    }

    return md;
  }

  async function parseLatex(latex: string, fieldIndex: number, fieldType: "parameter" | "min" | "max") {
    if (fieldType === "parameter") {
      await extremeValueCell.parameterFields[fieldIndex].parseLatex(latex);
    } else if (fieldType === "min") {
      await extremeValueCell.minFields[fieldIndex].parseLatex(latex);
    } else {
      await extremeValueCell.maxFields[fieldIndex].parseLatex(latex);
    }
    await extremeValueCell.parseExtremeValueStatements();
    triggerSaveNeeded(true);
    mathCellChanged();
  }

  async function parseQueryLatex(latex: string) {
    await extremeValueCell.queryField.parseLatex(latex);
    triggerSaveNeeded(true);
    mathCellChanged();
  }

  function addRow() {
    extremeValueCell.addRow();
    triggerSaveNeeded();
  }

  function deleteRow(rowIndex: number) {
    extremeValueCell.deleteRow(rowIndex);
    extremeValueCell.parseExtremeValueStatements();
    triggerSaveNeeded();
    mathCellChanged();
  }
</script>

<style>
  div.container {
    display: flex;
    flex-direction: column;
    row-gap: 8px;
  }

  div.query-row {
    display: flex;
    align-items: center;
    column-gap: 5px;
  }

  div.table-grid {
    display: grid;
    grid-template-columns: auto 1fr 1fr 1fr auto;
    align-items: center;
    row-gap: 2px;
    column-gap: 4px;
  }

  div.header {
    font-weight: bold;
    font-size: 0.85em;
    color: #555;
    padding: 2px 4px;
  }

  div.result-row {
    display: flex;
    align-items: center;
    column-gap: 8px;
    padding: 4px 0;
  }

  span.result-label {
    font-weight: bold;
    font-size: 0.9em;
    color: #333;
    min-width: 35px;
  }

  div.add-row-container {
    display: flex;
    justify-content: flex-start;
  }

  span.row-number {
    font-size: 0.8em;
    color: #888;
    text-align: center;
  }

  div.results-container {
    display: flex;
    flex-direction: column;
    row-gap: 4px;
    padding-top: 4px;
    border-top: 1px solid #ddd;
  }

  div.sensitivity-section {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #eee;
  }

  span.sensitivity-header {
    font-weight: bold;
    font-size: 0.85em;
    color: #555;
  }

  div.sensitivity-list {
    display: flex;
    flex-direction: column;
    row-gap: 2px;
    margin-top: 4px;
    padding-left: 8px;
  }

  div.sensitivity-entry {
    display: flex;
    align-items: center;
    column-gap: 8px;
    font-size: 0.85em;
  }

  span.param-name {
    min-width: 80px;
    font-family: monospace;
  }

  span.param-percent {
    color: #666;
  }

  @media print {
    div.add-row-container {
      display: none;
    }
  }
</style>

<div class="container">
  <!-- Query field -->
  <div class="query-row">
    <span class="result-label">Query:</span>
    <MathField
      editable={true}
      update={(e) => parseQueryLatex(e.latex)}
      enter={() => insertMathCellAfter({detail: {index: index}})}
      shiftEnter={() => insertMathCellAfter({detail: {index: index}})}
      modifierEnter={() => insertInsertCellAfter({detail: {index: index}})}
      mathField={extremeValueCell.queryField}
      parsingError={extremeValueCell.queryField.parsingError}
      parsePending={extremeValueCell.queryField.parsePending}
      bind:this={extremeValueCell.queryField.element}
      latex={extremeValueCell.queryField.latex}
    />
    {#if extremeValueCell.queryField.parsingError && !extremeValueCell.queryField.parsePending}
      <TooltipIcon direction="right" align="end">
        <span slot="tooltipText">{extremeValueCell.queryField.parsingErrorMessage}</span>
        <Error class="error"/>
      </TooltipIcon>
    {/if}
  </div>

  <!-- Parameter table -->
  <div class="table-grid">
    <!-- Header row -->
    <div class="header"></div>
    <div class="header">Parameter</div>
    <div class="header">Min</div>
    <div class="header">Max</div>
    <div class="header"></div>

    <!-- Data rows -->
    {#each extremeValueCell.parameterFields as paramField, i (paramField.id)}
      <span class="row-number">{i + 1}</span>

      <MathField
        editable={true}
        update={(e) => parseLatex(e.latex, i, "parameter")}
        mathField={extremeValueCell.parameterFields[i]}
        parsingError={extremeValueCell.parameterFields[i].parsingError}
        parsePending={extremeValueCell.parameterFields[i].parsePending}
        bind:this={extremeValueCell.parameterFields[i].element}
        latex={extremeValueCell.parameterFields[i].latex}
      />

      <MathField
        editable={true}
        update={(e) => parseLatex(e.latex, i, "min")}
        mathField={extremeValueCell.minFields[i]}
        parsingError={extremeValueCell.minFields[i].parsingError}
        parsePending={extremeValueCell.minFields[i].parsePending}
        bind:this={extremeValueCell.minFields[i].element}
        latex={extremeValueCell.minFields[i].latex}
      />

      <MathField
        editable={true}
        update={(e) => parseLatex(e.latex, i, "max")}
        mathField={extremeValueCell.maxFields[i]}
        parsingError={extremeValueCell.maxFields[i].parsingError}
        parsePending={extremeValueCell.maxFields[i].parsePending}
        bind:this={extremeValueCell.maxFields[i].element}
        latex={extremeValueCell.maxFields[i].latex}
      />

      {#if numRows > 1}
        <IconButton
          title="Delete row"
          id={`eva-delete-row-${index}-${i}`}
          click={() => deleteRow(i)}
        >
          <RowDelete size={16}/>
        </IconButton>
      {:else}
        <div></div>
      {/if}
    {/each}
  </div>

  <!-- Add row button -->
  {#if extremeValueCell.canAddRow}
    <div class="add-row-container">
      <IconButton
        title="Add parameter row"
        id={`eva-add-row-${index}`}
        click={addRow}
      >
        <Add size={16}/>
      </IconButton>
    </div>
  {/if}

  <!-- Results display -->
  {#if evaResult}
    <div class="results-container">
      {#if evaResult.error}
        <div class="result-row">
          <TooltipIcon direction="right" align="end">
            <span slot="tooltipText">{evaResult.error}</span>
            <Error class="error"/>
          </TooltipIcon>
          <span>{evaResult.error}</span>
        </div>
      {:else}
        <div class="result-row">
          <span class="result-label">Min:</span>
          <MathField
            hidden={appState.resultsInvalid}
            latex={`=${formatResultValue(evaResult.minResult)}${evaResult.minResult.unitsLatex ? '\\,' + evaResult.minResult.unitsLatex : ''}`}
          />
          <IconButton
            title="Format options"
            id={`eva-format-options-${index}`}
            click={openFormatOptions}
          >
            <SettingsAdjust size={16}/>
          </IconButton>
        </div>
        <div class="result-row">
          <span class="result-label">Max:</span>
          <MathField
            hidden={appState.resultsInvalid}
            latex={`=${formatResultValue(evaResult.maxResult)}${evaResult.maxResult.unitsLatex ? '\\,' + evaResult.maxResult.unitsLatex : ''}`}
          />
        </div>
        {#if evaResult.sensitivity && evaResult.sensitivity.length > 0}
          <div class="sensitivity-section">
            <span class="sensitivity-header">Sensitivity:</span>
            <div class="sensitivity-list">
              {#each evaResult.sensitivity as entry}
                <div class="sensitivity-entry">
                  <span class="param-name">{entry.paramName}</span>
                  <span class="param-percent">{entry.percentage.toFixed(1)}%</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<Modal
  bind:open={formatOptionsOpen}
  modalHeading="Number Format Options"
  primaryButtonText="Done"
  on:click:button--primary={closeFormatOptions}
  on:close={closeFormatOptions}
  size="sm"
>
  <NumberFormatOptionsDialog
    bind:this={formatOptionsDialogRef}
    numberFormatOptions={extremeValueCell.formatOptions}
    nullIfDefault={true}
    onchange={handleFormatOptionsChange}
  />
</Modal>
