import { Button } from "@mui/material";
import { X as XIcon, GitHub as GitHubIcon, Favorite as FavoriteIcon } from "@mui/icons-material";
import { open } from "@tauri-apps/plugin-shell";

export default function SocialFooter() {
  return (
    <div className="flex justify-end gap-2 pb-2">
      <Button variant="contained" size="small" onClick={() => open("https://twitter.com/marquina_osu")}><XIcon fontSize="small" /></Button>
      <Button variant="contained" size="small" onClick={() => open("https://buymeacoffee.com/sergiomarquina")}><FavoriteIcon fontSize="small" /></Button>
      <Button variant="contained" size="small" onClick={() => open("https://github.com/YusufOzmen01/kikitan-translator")}><GitHubIcon fontSize="small" /></Button>
      <Button variant="contained" size="small" onClick={() => open("https://discord.gg/jpkYCgpBGV")}><img src="/discordlogo.webp" className="invert" width={18} alt="Discord" /></Button>
    </div>
  );
}
