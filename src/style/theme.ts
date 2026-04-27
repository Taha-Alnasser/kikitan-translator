import { createTheme, Theme } from "@mui/material/styles";
import { tokensFor } from "./tokens";

export function makeMuiTheme(lightMode: boolean): Theme {
  const t = tokensFor(lightMode);
  return createTheme({
    palette: {
      mode: lightMode ? "light" : "dark",
      primary: { main: t.accent, contrastText: t.accentText },
      error: { main: t.danger },
      success: { main: t.success },
      warning: { main: t.warning },
      background: { default: t.surface, paper: t.surfaceElevated },
      text: { primary: t.text, secondary: t.textMuted, disabled: t.textDisabled },
      divider: t.border,
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: { borderColor: t.border },
          root: { color: t.text, "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: t.borderStrong } },
        },
      },
      MuiSelect: { styleOverrides: { icon: { color: t.textMuted } } },
      MuiMenu: { styleOverrides: { paper: { backgroundColor: t.surfaceElevated, color: t.text } } },
      MuiMenuItem: { styleOverrides: { root: { color: t.text } } },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiSwitch: { styleOverrides: { root: { /* MUI defaults follow palette */ } } },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: t.surfaceMuted, color: t.text, border: `1px solid ${t.border}` } } },
    },
  });
}
