import { Popover, Tree } from "@douyinfe/semi-ui";
import type { Text } from "@flowgram.ai/coze-editor/language-json";
import { type EditorAPI, transformerCreator } from "@flowgram.ai/coze-editor/preset-code";
import {
  getCurrentMentionReplaceRange,
  Mention,
  type MentionOpenChangeEvent,
  PositionMirror,
  useEditor,
} from "@flowgram.ai/coze-editor/react";
import {
  type CodeEditorPropsType,
  EditorVariableTagInject,
  JsonCodeEditor,
  PromptEditor,
  type PromptEditorPropsType,
  useVariableTree,
} from "@flowgram.ai/form-materials";
import { debounce } from "lodash-es";
import { useEffect, useMemo, useState } from "react";

const TRIGGER_CHARACTERS = ["{", "{}", "@"];

type Match = { match: string; range: [number, number] };

function findAllMatches(input: string, regex: RegExp): Match[] {
  const globalRegex = new RegExp(
    regex,
    regex.flags.includes("g") ? regex.flags : `${regex.flags}g`,
  );
  const matches: Match[] = [];
  let match: RegExpExecArray | null;

  while ((match = globalRegex.exec(input)) !== null) {
    if (match.index === globalRegex.lastIndex) {
      globalRegex.lastIndex++;
    }
    matches.push({
      match: match[0],
      range: [match.index, match.index + match[0].length],
    });
  }

  return matches;
}

const jsonVariableTransformer = transformerCreator((text: Text) => {
  const originalSource = text.toString();
  const matches = findAllMatches(originalSource, /\{\{([^}]*)\}\}/g);

  matches.forEach(({ range }) => {
    text.replaceRange(range[0], range[1], "null");
  });

  return text;
});

function SafeEditorVariableTree({
  triggerCharacters = TRIGGER_CHARACTERS,
}: {
  triggerCharacters?: string[];
}) {
  const [posKey, setPosKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const editor = useEditor<EditorAPI>();
  const treeData = useVariableTree({});

  const debounceUpdatePosKey = useMemo(
    () => debounce(() => setPosKey(String(Math.random())), 100),
    [],
  );

  useEffect(() => () => debounceUpdatePosKey.cancel(), [debounceUpdatePosKey]);

  const insert = (variablePath: string) => {
    if (!editor) {
      return;
    }

    const range = getCurrentMentionReplaceRange(editor.$view.state);
    if (!range) {
      return;
    }

    let { from, to } = range;
    while (editor.$view.state.doc.sliceString(from - 1, from) === "{") {
      from--;
    }
    while (editor.$view.state.doc.sliceString(to, to + 1) === "}") {
      to++;
    }

    editor.replaceText({
      from,
      to,
      text: `{{${variablePath}}}`,
    });

    setVisible(false);
  };

  const handleOpenChange = (event: MentionOpenChangeEvent) => {
    const nextPosition = event.state.selection.main.head;
    const isValidPosition = Number.isInteger(nextPosition) && nextPosition >= 0;

    setPosition(isValidPosition ? nextPosition : null);
    setVisible(event.value && isValidPosition);
  };

  const canRenderMirror = visible && position !== null;

  return (
    <>
      <Mention triggerCharacters={triggerCharacters} onOpenChange={handleOpenChange} />

      {canRenderMirror && (
        <Popover
          visible={visible}
          trigger="custom"
          position="topLeft"
          rePosKey={posKey}
          content={
            <div style={{ width: 300, maxHeight: 300, overflowY: "auto" }}>
              <Tree
                treeData={treeData}
                onExpand={() => {
                  debounceUpdatePosKey();
                }}
                onSelect={(value) => {
                  if (value === undefined || value === null || Array.isArray(value)) {
                    return;
                  }
                  insert(String(value));
                }}
              />
            </div>
          }
        >
          <PositionMirror
            position={position}
            onChange={() => {
              setPosKey(String(Math.random()));
            }}
          />
        </Popover>
      )}
    </>
  );
}

export function SafePromptEditorWithVariables(props: PromptEditorPropsType) {
  return (
    <PromptEditor {...props}>
      <SafeEditorVariableTree />
      <EditorVariableTagInject />
    </PromptEditor>
  );
}

export function SafeJsonEditorWithVariables(props: Omit<CodeEditorPropsType, "languageId">) {
  return (
    <JsonCodeEditor
      {...props}
      options={{
        transformer: jsonVariableTransformer,
        ...(props.options || {}),
      }}
    >
      <SafeEditorVariableTree triggerCharacters={["@"]} />
      <EditorVariableTagInject />
    </JsonCodeEditor>
  );
}
