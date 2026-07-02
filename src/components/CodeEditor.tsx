import { useEffect, useRef } from "react";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  Decoration,
  type DecorationSet,
} from "@codemirror/view";
import { defaultKeymap, indentWithTab, history, historyKeymap } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

// --- line-highlight extension (used by the trace visualizer) ---
const setHighlight = StateEffect.define<number | null>();

const highlightLineDeco = Decoration.line({ class: "cm-trace-line" });

const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setHighlight)) {
        const line = effect.value;
        if (line == null || line < 1 || line > tr.state.doc.lines) {
          deco = Decoration.none;
        } else {
          const pos = tr.state.doc.line(line).from;
          deco = Decoration.set([highlightLineDeco.range(pos)]);
        }
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

interface Props {
  value: string;
  onChange: (value: string) => void;
  highlightLine: number | null;
  readOnly?: boolean;
}

export function CodeEditor({ value, onChange, highlightLine, readOnly }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // create the editor once
  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        python(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        highlightField,
        EditorState.readOnly.of(!!readOnly),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => view.destroy();
    // intentionally run once — value/readOnly are synced via effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sync external value changes (e.g. loading an example) into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  // apply the trace highlight line
  useEffect(() => {
    viewRef.current?.dispatch({ effects: setHighlight.of(highlightLine) });
  }, [highlightLine]);

  return <div className="editor-host" ref={hostRef} />;
}
