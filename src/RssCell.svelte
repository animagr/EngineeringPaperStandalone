<script lang="ts">
  import { bignumber, format, type BigNumber, type FormatOptions } from "mathjs";
  import appState from "./stores.svelte";
  import { isRssResult, isFiniteImagResult, type Result, type FiniteImagResult } from "./resultTypes";
  import { defaultConfig, type NumberFormatOptions } from "./sheet/Sheet";

  import type RssCell from "./cells/RssCell.svelte";

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
    rssCell: RssCell;
    insertMathCellAfter: (arg: {detail: {index: number}}) => void;
    insertInsertCellAfter: (arg: {detail: {index: number}}) => void;
    mathCellChanged: () => void;
    triggerSaveNeeded: (pendingMathCellChange?: boolean) => void;
  }

  let {
    index,
    rssCell,
    insertMathCellAfter,
    insertInsertCellAfter,
    mathCellChanged,
    triggerSaveNeeded
  }: Props = $props();

  let numRows = $derived(rssCell.parameterFields.length);

  let result = $derived(appState.results[index]);
  let rssResult = $derived(result && !Array.isArray(result) && isRssResult(result) ? result : null);

  let formatOptionsOpen = $state(false);
  let formatOptionsDialogRef: NumberFormatOptionsDialog;

  let formatOptions = $derived(rssCell.formatOptions ?? defaultConfig.mathCellConfig.formatOptions);

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
      return resultObj.value;
    }
    const numValue = parseFloat(resultObj.value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return customFormat(bignumber(resultObj.value), formatOptions);
    }
    return resultObj.symbolicValue ?? resultObj.value;
  }

  function openFormatOptions() {
    formatOptionsOpen = true;
  }

  function handleFormatOptionsChange(newOptions: NumberFormatOptions | null) {
    rssCell.formatOptions = newOptions;
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

    md += "**Root Sum Square Analysis**\n\n";

    if (rssCell.queryField.latex) {
      md += `Query: ${startDelimiter}${rssCell.queryField.latex}${endDelimiter}\n\n`;
    }

    md += "| Parameter | Min | Nominal | Max |\n";
    md += "|-----------|-----|---------|-----|\n";
    for (let i = 0; i < rssCell.parameterFields.length; i++) {
      const param = rssCell.parameterFields[i].latex || "";
      const min = rssCell.minFields[i].latex || "";
      const nominal = rssCell.nominalFields[i].latex || "";
      const max = rssCell.maxFields[i].latex || "";
      md += `| ${startDelimiter}${param}${endDelimiter} | ${startDelimiter}${min}${endDelimiter} | ${startDelimiter}${nominal}${endDelimiter} | ${startDelimiter}${max}${endDelimiter} |\n`;
    }
    md += "\n";

    if (rssResult) {
      if (rssResult.error) {
        md += `Error: ${rssResult.error}\n\n`;
      } else {
        md += `Nominal: ${formatResultValue(rssResult.nominalResult)}${rssResult.nominalResult.unitsLatex ? ' ' + rssResult.nominalResult.unitsLatex : ''}\n\n`;
        md += `RSS Min: ${formatResultValue(rssResult.minResult)}${rssResult.minResult.unitsLatex ? ' ' + rssResult.minResult.unitsLatex : ''}\n\n`;
        md += `RSS Max: ${formatResultValue(rssResult.maxResult)}${rssResult.maxResult.unitsLatex ? ' ' + rssResult.maxResult.unitsLatex : ''}\n\n`;
        if (rssResult.sensitivity && rssResult.sensitivity.length > 0) {
          md += `**Sensitivity (% of RSS variance):**\n`;
          for (const entry of rssResult.sensitivity) {
            md += `- ${entry.paramName}: ${entry.varianceContribution.toFixed(1)}%\n`;
          }
          md += `\n`;
        }
      }
    }

    return md;
  }

  async function parseLatex(latex: string, fieldIndex: number, fieldType: "parameter" | "min" | "nominal" | "max") {
    if (fieldType === "parameter") {
      await rssCell.parameterFields[fieldIndex].parseLatex(latex);
    } else if (fieldType === "min") {
      await rssCell.minFields[fieldIndex].parseLatex(latex);
    } else if (fieldType === "nominal") {
      await rssCell.nominalFields[fieldIndex].parseLatex(latex);
    } else {
      await rssCell.maxFields[fieldIndex].parseLatex(latex);
    }
    await rssCell.parseRssStatements();
    triggerSaveNeeded(true);
    mathCellChanged();
  }

  async function parseQueryLatex(latex: string) {
    await rssCell.queryField.parseLatex(latex);
    triggerSaveNeeded(true);
    mathCellChanged();
  }

  function addRow() {
    rssCell.addRow();
    triggerSaveNeeded();
  }

  function deleteRow(rowIndex: number) {
    rssCell.deleteRow(rowIndex);
    rssCell.parseRssStatements();
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
    grid-template-columns: auto 1fr 1fr 1fr 1fr auto;
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
    min-width: 65px;
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

  span.param-delta {
    min-width: 60px;
    color: #444;
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
      mathField={rssCell.queryField}
      parsingError={rssCell.queryField.parsingError}
      parsePending={rssCell.queryField.parsePending}
      bind:this={rssCell.queryField.element}
      latex={rssCell.queryField.latex}
    />
    {#if rssCell.queryField.parsingError && !rssCell.queryField.parsePending}
      <TooltipIcon direction="right" align="end">
        <span slot="tooltipText">{rssCell.queryField.parsingErrorMessage}</span>
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
    <div class="header">Nominal</div>
    <div class="header">Max</div>
    <div class="header"></div>

    <!-- Data rows -->
    {#each rssCell.parameterFields as paramField, i (paramField.id)}
      <span class="row-number">{i + 1}</span>

      <MathField
        editable={true}
        update={(e) => parseLatex(e.latex, i, "parameter")}
        mathField={rssCell.parameterFields[i]}
        parsingError={rssCell.parameterFields[i].parsingError}
        parsePending={rssCell.parameterFields[i].parsePending}
        bind:this={rssCell.parameterFields[i].element}
        latex={rssCell.parameterFields[i].latex}
      />

      <MathField
        editable={true}
        update={(e) => parseLatex(e.latex, i, "min")}
        mathField={rssCell.minFields[i]}
        parsingError={rssCell.minFields[i].parsingError}
        parsePending={rssCell.minFields[i].parsePending}
        bind:this={rssCell.minFields[i].element}
        latex={rssCell.minFields[i].latex}
      />

      <MathField
        editable={true}
        update={(e) => parseLatex(e.latex, i, "nominal")}
        mathField={rssCell.nominalFields[i]}
        parsingError={rssCell.nominalFields[i].parsingError}
        parsePending={rssCell.nominalFields[i].parsePending}
        bind:this={rssCell.nominalFields[i].element}
        latex={rssCell.nominalFields[i].latex}
      />

      <MathField
        editable={true}
        update={(e) => parseLatex(e.latex, i, "max")}
        mathField={rssCell.maxFields[i]}
        parsingError={rssCell.maxFields[i].parsingError}
        parsePending={rssCell.maxFields[i].parsePending}
        bind:this={rssCell.maxFields[i].element}
        latex={rssCell.maxFields[i].latex}
      />

      {#if numRows > 1}
        <IconButton
          title="Delete row"
          id={`rss-delete-row-${index}-${i}`}
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
  {#if rssCell.canAddRow}
    <div class="add-row-container">
      <IconButton
        title="Add parameter row"
        id={`rss-add-row-${index}`}
        click={addRow}
      >
        <Add size={16}/>
      </IconButton>
    </div>
  {/if}

  <!-- Results display -->
  {#if rssResult}
    <div class="results-container">
      {#if rssResult.error}
        <div class="result-row">
          <TooltipIcon direction="right" align="end">
            <span slot="tooltipText">{rssResult.error}</span>
            <Error class="error"/>
          </TooltipIcon>
          <span>{rssResult.error}</span>
        </div>
      {:else}
        <div class="result-row">
          <span class="result-label">Nominal:</span>
          <MathField
            hidden={appState.resultsInvalid}
            latex={`=${formatResultValue(rssResult.nominalResult)}${rssResult.nominalResult.unitsLatex ? '\\,' + rssResult.nominalResult.unitsLatex : ''}`}
          />
          <IconButton
            title="Format options"
            id={`rss-format-options-${index}`}
            click={openFormatOptions}
          >
            <SettingsAdjust size={16}/>
          </IconButton>
        </div>
        <div class="result-row">
          <span class="result-label">RSS Min:</span>
          <MathField
            hidden={appState.resultsInvalid}
            latex={`=${formatResultValue(rssResult.minResult)}${rssResult.minResult.unitsLatex ? '\\,' + rssResult.minResult.unitsLatex : ''}`}
          />
        </div>
        <div class="result-row">
          <span class="result-label">RSS Max:</span>
          <MathField
            hidden={appState.resultsInvalid}
            latex={`=${formatResultValue(rssResult.maxResult)}${rssResult.maxResult.unitsLatex ? '\\,' + rssResult.maxResult.unitsLatex : ''}`}
          />
        </div>
        {#if rssResult.sensitivity && rssResult.sensitivity.length > 0}
          <div class="sensitivity-section">
            <span class="sensitivity-header">Sensitivity (% of RSS variance):</span>
            <div class="sensitivity-list">
              {#each rssResult.sensitivity as entry}
                <div class="sensitivity-entry">
                  <span class="param-name">{entry.paramName}</span>
                  <span class="param-delta">|delta|={entry.delta.toPrecision(4)}</span>
                  <span class="param-percent">{entry.varianceContribution.toFixed(1)}%</span>
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
    numberFormatOptions={rssCell.formatOptions}
    nullIfDefault={true}
    onchange={handleFormatOptionsChange}
  />
</Modal>
