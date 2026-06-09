import { forwardRef } from "react";

import { fontSizeOptions, themeBgOptions } from "../options";
import type { FontSize, ThemeBg } from "../types";

interface ThemePanelProps {
  themeBg: ThemeBg;
  onThemeBgChange: (bg: ThemeBg) => void;
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
}

export const ThemePanel = forwardRef<HTMLDivElement, ThemePanelProps>(function ThemePanel(
  { themeBg, onThemeBgChange, fontSize, onFontSizeChange },
  ref,
) {
  return (
    <div className="theme-panel" ref={ref}>
      <div className="theme-panel-section">
        <div className="theme-panel-label">Background</div>
        <div className="theme-color-options">
          {themeBgOptions.map((opt) => (
            <button
              key={opt.key}
              className={`theme-color-swatch${themeBg === opt.key ? " active" : ""}`}
              style={{ background: opt.color }}
              title={opt.label}
              onClick={() => onThemeBgChange(opt.key)}
            />
          ))}
        </div>
      </div>
      <div className="theme-panel-section">
        <div className="theme-panel-label">Font size</div>
        <div className="theme-font-options">
          {fontSizeOptions.map((opt) => (
            <button
              key={opt.key}
              className={`theme-font-button${fontSize === opt.key ? " active" : ""}`}
              onClick={() => onFontSizeChange(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
