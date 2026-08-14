import { Button } from "@buildingai/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@buildingai/ui/components/ui/collapsible";
import { Check, ChevronDown, Copy, FileCode2 } from "lucide-react";
import { useState } from "react";

type DiffLineType = "context" | "addition" | "deletion";

export type LuaCodeDiffLine = {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
};

export type LuaCodeDiffHunk = {
  header: string;
  lines: LuaCodeDiffLine[];
};

export type LuaCodeDiff = {
  additions: number;
  deletions: number;
  hunks: LuaCodeDiffHunk[];
};

type DiffOperation = {
  type: DiffLineType;
  content: string;
};

const DIFF_CONTEXT_LINES = 3;

function splitLines(value: string): string[] {
  return value.replace(/\r\n/g, "\n").split("\n");
}

function backtrackDiff(trace: Map<number, number>[], before: string[], after: string[]) {
  const operations: DiffOperation[] = [];
  let x = before.length;
  let y = after.length;

  for (let depth = trace.length - 1; depth >= 0; depth -= 1) {
    const frontier = trace[depth];
    const diagonal = x - y;
    const previousDiagonal =
      diagonal === -depth ||
      (diagonal !== depth &&
        (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY) <
          (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY))
        ? diagonal + 1
        : diagonal - 1;
    const previousX = frontier.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;

    while (x > previousX && y > previousY) {
      operations.push({ type: "context", content: before[x - 1] });
      x -= 1;
      y -= 1;
    }

    if (depth === 0) break;

    if (x === previousX) {
      operations.push({ type: "addition", content: after[y - 1] });
      y -= 1;
    } else {
      operations.push({ type: "deletion", content: before[x - 1] });
      x -= 1;
    }
  }

  return operations.reverse();
}

function calculateOperations(before: string[], after: string[]): DiffOperation[] {
  if (before.length * after.length > 500_000) {
    let prefixLength = 0;
    while (
      prefixLength < before.length &&
      prefixLength < after.length &&
      before[prefixLength] === after[prefixLength]
    ) {
      prefixLength += 1;
    }

    let suffixLength = 0;
    while (
      suffixLength < before.length - prefixLength &&
      suffixLength < after.length - prefixLength &&
      before[before.length - suffixLength - 1] === after[after.length - suffixLength - 1]
    ) {
      suffixLength += 1;
    }

    return [
      ...before.slice(0, prefixLength).map((content) => ({ type: "context" as const, content })),
      ...before
        .slice(prefixLength, before.length - suffixLength)
        .map((content) => ({ type: "deletion" as const, content })),
      ...after
        .slice(prefixLength, after.length - suffixLength)
        .map((content) => ({ type: "addition" as const, content })),
      ...before
        .slice(before.length - suffixLength)
        .map((content) => ({ type: "context" as const, content })),
    ];
  }

  const maxDepth = before.length + after.length;
  const frontier = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];

  for (let depth = 0; depth <= maxDepth; depth += 1) {
    trace.push(new Map(frontier));

    for (let diagonal = -depth; diagonal <= depth; diagonal += 2) {
      const moveDown =
        diagonal === -depth ||
        (diagonal !== depth &&
          (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY) <
            (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY));
      let x = moveDown ? (frontier.get(diagonal + 1) ?? 0) : (frontier.get(diagonal - 1) ?? 0) + 1;
      let y = x - diagonal;

      while (x < before.length && y < after.length && before[x] === after[y]) {
        x += 1;
        y += 1;
      }

      frontier.set(diagonal, x);
      if (x >= before.length && y >= after.length) {
        return backtrackDiff(trace, before, after);
      }
    }
  }

  return [];
}

export function createLuaCodeDiff(beforeCode: string, afterCode: string): LuaCodeDiff | undefined {
  if (beforeCode === afterCode) return undefined;

  const operations = calculateOperations(splitLines(beforeCode), splitLines(afterCode));
  const numberedLines: LuaCodeDiffLine[] = [];
  let oldLineNumber = 1;
  let newLineNumber = 1;
  let additions = 0;
  let deletions = 0;

  for (const operation of operations) {
    if (operation.type === "addition") {
      additions += 1;
      numberedLines.push({ ...operation, newLineNumber });
      newLineNumber += 1;
    } else if (operation.type === "deletion") {
      deletions += 1;
      numberedLines.push({ ...operation, oldLineNumber });
      oldLineNumber += 1;
    } else {
      numberedLines.push({ ...operation, oldLineNumber, newLineNumber });
      oldLineNumber += 1;
      newLineNumber += 1;
    }
  }

  const changeIndexes = numberedLines
    .map((line, index) => (line.type === "context" ? -1 : index))
    .filter((index) => index >= 0);
  const ranges: Array<{ start: number; end: number }> = [];

  for (const changeIndex of changeIndexes) {
    const start = Math.max(0, changeIndex - DIFF_CONTEXT_LINES);
    const end = Math.min(numberedLines.length, changeIndex + DIFF_CONTEXT_LINES + 1);
    const previousRange = ranges.at(-1);

    if (previousRange && start <= previousRange.end)
      previousRange.end = Math.max(previousRange.end, end);
    else ranges.push({ start, end });
  }

  const hunks = ranges.map(({ start, end }) => {
    const lines = numberedLines.slice(start, end);
    const oldLines = lines.filter((line) => line.type !== "addition");
    const newLines = lines.filter((line) => line.type !== "deletion");
    const oldStart =
      oldLines[0]?.oldLineNumber ?? numberedLines[start]?.oldLineNumber ?? oldLineNumber;
    const newStart =
      newLines[0]?.newLineNumber ?? numberedLines[start]?.newLineNumber ?? newLineNumber;

    return {
      header: `@@ -${oldStart},${oldLines.length} +${newStart},${newLines.length} @@`,
      lines,
    };
  });

  return { additions, deletions, hunks };
}

export function formatLuaCodeDiff(diff: LuaCodeDiff): string {
  const output = ["--- a/module.lua", "+++ b/module.lua"];

  for (const hunk of diff.hunks) {
    output.push(hunk.header);
    for (const line of hunk.lines) {
      const prefix = line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " ";
      output.push(`${prefix}${line.content}`);
    }
  }

  return output.join("\n");
}

function lineClassName(type: DiffLineType) {
  if (type === "addition") {
    return "bg-emerald-500/10 text-emerald-950 dark:text-emerald-100";
  }
  if (type === "deletion") return "bg-red-500/10 text-red-950 dark:text-red-100";
  return "text-foreground";
}

function linePrefix(type: DiffLineType) {
  if (type === "addition") return "+";
  if (type === "deletion") return "-";
  return " ";
}

export function LuaCodeDiffView({ diff }: { diff: LuaCodeDiff }) {
  const [copied, setCopied] = useState(false);

  const copyDiff = async () => {
    await navigator.clipboard.writeText(formatLuaCodeDiff(diff));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Collapsible defaultOpen className="group/diff bg-background overflow-hidden rounded-md border">
      <div className="flex min-h-10 items-center gap-2 border-b px-3">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
          <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-data-[state=closed]/diff:-rotate-90" />
          <FileCode2 className="size-4 shrink-0" />
          <span className="min-w-0 truncate font-mono text-xs font-medium">module.lua</span>
          <span className="ml-auto shrink-0 font-mono text-xs text-emerald-600">
            +{diff.additions}
          </span>
          <span className="shrink-0 font-mono text-xs text-red-600">-{diff.deletions}</span>
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0"
          title="复制代码变更"
          onClick={() => void copyDiff()}
        >
          {copied ? <Check className="text-emerald-600" /> : <Copy />}
        </Button>
      </div>
      <CollapsibleContent>
        <div className="max-h-96 overflow-auto bg-zinc-50 text-xs dark:bg-zinc-950">
          <div className="min-w-max font-mono leading-5">
            {diff.hunks.map((hunk) => (
              <div key={hunk.header}>
                <div className="border-y border-blue-500/15 bg-blue-500/10 px-3 py-1 text-blue-700 first:border-t-0 dark:text-blue-300">
                  {hunk.header}
                </div>
                {hunk.lines.map((line, index) => (
                  <div
                    key={`${hunk.header}-${index}`}
                    className={`grid grid-cols-[3rem_3rem_1.5rem_minmax(0,1fr)] ${lineClassName(line.type)}`}
                  >
                    <span className="border-r px-2 text-right text-zinc-400 select-none">
                      {line.oldLineNumber ?? ""}
                    </span>
                    <span className="border-r px-2 text-right text-zinc-400 select-none">
                      {line.newLineNumber ?? ""}
                    </span>
                    <span className="px-2 text-center select-none">{linePrefix(line.type)}</span>
                    <span className="pr-4 whitespace-pre">{line.content || " "}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
