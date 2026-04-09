# Plan: Extreme Value Analysis (EVA) Cell

## Context

Users want to find worst-case min/max of an output expression by evaluating it at all 2^n combinations of input parameter min/max bounds. Currently this requires manually creating multiple sheets. The EVA cell automates this with a table of parameters (name, min, max), a query field, and min/max output display.

---

## User-Facing Design

**Table**: rows of `Parameter | Min | Max` (no units column — units inherited from parameter's assignment elsewhere on sheet)
**Query field**: expression to evaluate (e.g., `I_{out}=`)
**Output**: min and max result values

---

## How It Works (Computation)

The key insight: for `V_{ref} = 4.0\ [V]`, the parser generates an implicit param symbol (`implicit_param__X_Y_Z`) with `si_value: "4.0"`. The query's symbolic expression contains these symbols. By overriding their values in `parameter_subs` and re-evaluating, we get the result at different parameter values.

After normal `evaluate_statements()` computes the nominal result:
1. Find the query's symbolic expression from `combined_expressions`
2. Find each varied parameter's implicit param symbol from `expanded_statements` (match by name)
3. Get min/max numeric values from the EVA definition's min/max assignment statements
4. For each 2^n combination (`itertools.product`):
   - Copy `parameter_subs`, override varied param symbols
   - Call `get_evaluated_expression()` with fresh `expression_cache`
   - Call `get_result()`, track numeric min and max
5. Replace `results[query_index]` with `ExtremeValueResult`

---

## New Files

### `src/cells/ExtremeValueCell.svelte.ts`

Cell class extending BaseCell:
```
type: "extremeValue"
parameterFields: MathField[]     (type: "parameter")
minFields: MathField[]           (type: "number")
maxFields: MathField[]           (type: "number")
queryField: MathField            (type: "math")
combinedMinFields: MathField[]   (internal, for building "param = min_value" assignments)
combinedMaxFields: MathField[]   (internal, for building "param = max_value" assignments)
```

Key methods:
- `parseExtremeValueStatements()` — builds combined LaTeX `param = value` for min/max, parses via MathField (same pattern as TableCell's `parseTableStatements()`)
- `addRow()` / `deleteRow()` (max 20 rows enforced)
- `serialize()` → `DatabaseExtremeValueCell`
- `getExtremeValueDefinition()` → returns definition for Python

### `src/ExtremeValueCell.svelte`

Svelte component with CSS grid layout:
- Query MathField at top
- Table: Parameter | Min | Max columns with MathField inputs
- Add/delete row buttons
- Result display area: "Min: [value] [units]" / "Max: [value] [units]"
- Props: `index, extremeValueCell, insertMathCellAfter, insertInsertCellAfter, mathCellChanged, triggerSaveNeeded`
- Export `getMarkdown(centerEquations)` for document export

---

## Files to Modify

### `src/cells/BaseCell.ts`
- Add `"extremeValue"` to `CellTypes` union
- Add `DatabaseExtremeValueCell` type:
  ```typescript
  type DatabaseExtremeValueCell = {
    type: "extremeValue";
    id: number;
    parameterLatexs: string[];
    minLatexs: string[];
    maxLatexs: string[];
    queryLatex: string;
  }
  ```
- Add to `DatabaseCell` union

### `src/cells/Cells.ts`
- Import ExtremeValueCell, add to `Cell` union, add case in `cellFactory()`

### `src/stores.svelte.ts`
- Add `else if` branch in `addCell()` for `"extremeValue"`

### `src/InsertCell.svelte`
- Add button (use `Analytics` or similar carbon icon)

### `src/Cell.svelte`
- Import ExtremeValueCell class + component, add routing case

### `src/types.ts`
- Add `ExtremeValueDefinition` type:
  ```typescript
  type ExtremeValueDefinition = {
    parameters: {
      name: string;
      minStatements: AssignmentStatement[];
      maxStatements: AssignmentStatement[];
    }[];
    queryIndex: number;
  };
  ```
- Add `extremeValueDefinitions: ExtremeValueDefinition[]` to `StatementsAndSystems`

### `src/resultTypes.ts`
- Add:
  ```typescript
  type ExtremeValueResult = {
    extremeValueResult: true;
    nominalResult: Result | FiniteImagResult;
    minResult: Result | FiniteImagResult;
    maxResult: Result | FiniteImagResult;
    error?: string;
  };
  ```
- Add `isExtremeValueResult()` type guard
- Add to result union types

### `src/App.svelte`
- `getStatementsAndSystemsForPython()`: add `else if (cell instanceof ExtremeValueCell)` — query → `statements`, min/max assignments → `endStatements`, definition → `extremeValueDefinitions[]`
- Result distribution (~line 1053): add `"extremeValue"` to types that consume results
- Pass `extremeValueDefinitions` in the return object

### `public/dimensional_analysis.py`
- Add `ExtremeValueDefinition` and `ExtremeValueResult` TypedDict classes
- Add `extremeValueDefinitions` to `StatementsAndSystems` (NotRequired, default `[]`)
- Thread through `solve_sheet()` → `get_query_values()` → `evaluate_statements()`
- After main evaluation loop in `evaluate_statements()`, add EVA processing:
  1. For each definition, find query's combined expression by index
  2. Find each varied parameter's assignment in `expanded_statements` (match by `name`)
  3. Get the implicit param symbol from the assignment
  4. Get min/max SI values from the definition's min/max statements' `implicitParams`
  5. `itertools.product([min, max], repeat=n)` for all combinations
  6. For each combo: copy `parameter_subs`, override, `get_evaluated_expression()` with fresh cache, `get_result()`, track min/max
  7. Replace `results[query_index]` with `ExtremeValueResult`

---

## Constraints

- **No units in EVA table** — min/max are plain numbers; units from the parameter's sheet definition
- **Max 20 parameters** — enforced in frontend and backend
- **Simple assignments only (v1)** — error if varied parameter has complex expression (not a single `param = number [unit]`)
- **Numeric results only** — error if query produces symbolic output
- **Fresh `expression_cache`** per combination to avoid stale cached results
- **Backwards compatible** — `extremeValueDefinitions` defaults to `[]`, old sheets unaffected

---

## Implementation Status

1. **Types**: `BaseCell.ts`, `resultTypes.ts`, `types.ts` — DONE
2. **Cell model**: `ExtremeValueCell.svelte.ts` — DONE
3. **Registration**: `Cells.ts`, `stores.svelte.ts`, `InsertCell.svelte`, `Cell.svelte` — DONE
4. **UI component**: `ExtremeValueCell.svelte` — DONE
5. **Pipeline integration**: `App.svelte` — DONE
6. **Python computation**: `dimensional_analysis.py` — DONE
7. **Build**: compiles cleanly with `npm run build:standalone` — DONE
8. **Testing**: manual test needed

---

## Verification

1. `npm run build:standalone && npm run start:standalone`
2. Create math cells: `V=10\ [V]`, `R=1000\ [\Omega]`, `I=\frac{V}{R}=`
3. Add EVA cell, set parameters: V (min: 8, max: 12), R (min: 900, max: 1100)
4. Set query: `I=`
5. Verify min ≈ 0.00727 A (8/1100), max ≈ 0.01333 A (12/900)
6. Run `npx playwright test` — no regressions
