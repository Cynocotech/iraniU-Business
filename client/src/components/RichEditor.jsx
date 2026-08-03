import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  Alignment,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
  Heading,
  HorizontalLine,
  Indent,
  IndentBlock,
  Italic,
  Link,
  List,
  Paragraph,
  Strikethrough,
  Table,
  TableCellProperties,
  TableColumnResize,
  TableProperties,
  TableToolbar,
  Underline,
  Undo,
} from "ckeditor5";
import "ckeditor5/ckeditor5.css";

const EDITOR_CONFIG = {
  licenseKey: "GPL",
  plugins: [
    Alignment,
    BlockQuote,
    Bold,
    Essentials,
    FontBackgroundColor,
    FontColor,
    FontFamily,
    FontSize,
    Heading,
    HorizontalLine,
    Indent,
    IndentBlock,
    Italic,
    Link,
    List,
    Paragraph,
    Strikethrough,
    Table,
    TableCellProperties,
    TableColumnResize,
    TableProperties,
    TableToolbar,
    Underline,
    Undo,
  ],
  toolbar: {
    items: [
      "undo",
      "redo",
      "|",
      "heading",
      "|",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "|",
      "fontFamily",
      "fontSize",
      "fontColor",
      "fontBackgroundColor",
      "|",
      "alignment",
      "|",
      "bulletedList",
      "numberedList",
      "indent",
      "outdent",
      "|",
      "link",
      "blockQuote",
      "insertTable",
      "horizontalLine",
    ],
    shouldNotGroupWhenFull: true,
  },
  table: {
    contentToolbar: [
      "tableColumn",
      "tableRow",
      "mergeTableCells",
      "tableProperties",
      "tableCellProperties",
    ],
  },
  heading: {
    options: [
      { model: "paragraph", title: "Normal", class: "ck-heading_paragraph" },
      { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
      { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" },
      { model: "heading4", view: "h4", title: "Heading 4", class: "ck-heading_heading4" },
    ],
  },
  fontSize: {
    options: [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36],
    supportAllValues: false,
  },
  link: {
    defaultProtocol: "https://",
    decorators: {
      openInNewTab: {
        mode: "manual",
        label: "Open in new tab",
        attributes: { target: "_blank", rel: "noopener noreferrer" },
      },
    },
  },
};

/**
 * @param {{ value: string, onChange: (html: string) => void, placeholder?: string, rtl?: boolean, minHeight?: number }} props
 */
export default function RichEditor({ value, onChange, placeholder, rtl = true, minHeight = 200 }) {
  return (
    <div
      className="rich-editor-wrap"
      style={{ "--ck-min-height": `${minHeight}px`, direction: rtl ? "rtl" : "ltr" }}
    >
      <CKEditor
        editor={ClassicEditor}
        config={{
          ...EDITOR_CONFIG,
          placeholder: placeholder || "",
          language: {
            content: rtl ? "ar" : "en",
          },
        }}
        data={value || ""}
        onChange={(_event, editor) => {
          onChange(editor.getData());
        }}
      />
    </div>
  );
}
