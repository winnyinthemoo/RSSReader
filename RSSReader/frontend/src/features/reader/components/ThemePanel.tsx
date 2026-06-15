import { forwardRef } from "react";

import type { AppLanguage } from "../../../i18n";
import { getAppText } from "../../../i18n";
import { fontSizeOptions, themeBgOptions } from "../options";
import type { FontSize, ThemeBg } from "../types";

interface ThemePanelProps {
  appLanguage: AppLanguage;
  themeBg: ThemeBg;
  onThemeBgChange: (bg: ThemeBg) => void;
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
}

export const ThemePanel = forwardRef<HTMLDivElement, ThemePanelProps>(function ThemePanel(
  { appLanguage, themeBg, onThemeBgChange, fontSize, onFontSizeChange },
  ref,
) {
  const text = getAppText(appLanguage);

  return (
    <div className="theme-panel" ref={ref}>
      <div className="theme-panel-section">
        <div className="theme-panel-label">{text.reader.background}</div>
        <div className="theme-color-options">
          {themeBgOptions.map((opt) => (
            <button
              key={opt.key}
              className={`theme-color-swatch${themeBg === opt.key ? " active" : ""}`}
              style={{ background: opt.color }}
              title={text.settings.reading.themeLabels[opt.key]}
              onClick={() => onThemeBgChange(opt.key)}
            />
          ))}
        </div>
      </div>
      <div className="theme-panel-section">
        <div className="theme-panel-label">{text.reader.fontSize}</div>
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
