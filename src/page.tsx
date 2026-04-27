import * as React from 'react';

import Kikitan from "./pages/Kikitan"

import {
  AppBar,
  Toolbar,
  Typography,
  Select,
  MenuItem,
  Button,
  IconButton,
  CircularProgress
} from '@mui/material';

import { ThemeProvider } from '@mui/material/styles';
import { makeMuiTheme } from './style/theme';
import { applyTokensToRoot } from './style/tokens';

import {
  Settings,
  Translate,
  WbSunny,
  NightsStay,
  Favorite
} from '@mui/icons-material';

import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import { emitTo, listen } from "@tauri-apps/api/event";

import SettingsPage from './pages/Settings';


import { DEFAULT_CONFIG, load_config, update_config } from './util/config';
import { Lang } from './util/constants';
import { getVersion } from '@tauri-apps/api/app';

import Changelogs from './pages/Changelogs';

import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

import { localization } from './util/localization';

import translateGT from './translators/google_translate';
import QuickstartMenu from './components/Quickstart';
import Modal from './components/Modal';
function App() {
  const [quickstartVisible, setQuickstartVisible] = React.useState(true)
  const [changelogsVisible, setChangelogsVisible] = React.useState(false)
  const [settingsVisible, setSettingsVisible] = React.useState(false)
  const [updateVisible, setUpdateVisible] = React.useState(false)
  const [donateVisible, setDonateVisible] = React.useState(false)
  const [googleServersErrorVisible, setGoogleServersErrorVisible] = React.useState(false)

  const [config, setConfig] = React.useState(DEFAULT_CONFIG)
  const [lang, setLang] = React.useState<Lang>("en")
  const [appVersion, setAppVersion] = React.useState("")

  const [loaded, setLoaded] = React.useState(false)
  const [vrchatRunning, setVrchatRunning] = React.useState(false)

  React.useEffect(() => { applyTokensToRoot(config.light_mode); }, [config.light_mode]);

  React.useEffect(() => {
    if (loaded) update_config(config)
  }, [config])

  React.useEffect(() => {
    const cfg = load_config()
    const language = localStorage.getItem("lang") as Lang | null

    setQuickstartVisible(localStorage.getItem("firstTimeSetupComplete") == null || language == null)
    if (!(localStorage.getItem("firstTimeSetupComplete") == null || language == null)) {
      getVersion().then((version) => {
        setAppVersion(version)
        setChangelogsVisible(localStorage.getItem("changelogsViewed") != version)

        setTimeout(() => localStorage.setItem("changelogsViewed", version), 1000)
      })
    }

    setLang(language == null ? "en" : language)
    setConfig(cfg)

    check().then((update) => {
      setUpdateVisible(update != null)

      update?.downloadAndInstall().then(() => {
        relaunch()
      });
    });

    translateGT("Hello, how are you?", "en-US", "tr-TR").then((out) => { console.log("Can access to Google servers: " + out) }).catch(err => {
      console.log(err)

      setGoogleServersErrorVisible(true)
    })

    invoke("start_vrc_listener")

    setTimeout(() => setLoaded(true), 300);

    if (localStorage.getItem("last_donation") == null) {
      localStorage.setItem("last_donation", "1")
    } else {
      const last = parseInt(localStorage.getItem("last_donation")!)

      if ((last + 60 * 60 * 12 * 1000) <= Date.now()) {
        setDonateVisible(true)
        localStorage.setItem("last_donation", `${Date.now()}`)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!quickstartVisible) {
      getVersion().then((version) => {
        setAppVersion(version)
        setChangelogsVisible(localStorage.getItem("changelogsViewed") != version)

        setTimeout(() => localStorage.setItem("changelogsViewed", version), 1000)
      })
    }
  }, [quickstartVisible])

  // Poll VRChat running status every 5s for vrc_only overlay mode
  React.useEffect(() => {
    const poll = () => invoke<boolean>("is_vrchat_running").then(setVrchatRunning);
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // Respond to config-request from overlay window and push config on any change
  React.useEffect(() => {
    const sendConfig = () => {
        if (!config.screen_overlay) return;
        emitTo("screen-overlay", "screen-overlay:config", config.screen_overlay);
    };

    sendConfig();

    const unlisten = listen("screen-overlay:config-request", () => {
        sendConfig();
    });

    return () => { unlisten.then((fn) => fn()); };
  }, [config.screen_overlay]);

  // Respond to config-request from overlay 2 window and push config on any change
  React.useEffect(() => {
    const sendConfig2 = () => {
        if (!config.screen_overlay_2) return;
        emitTo("screen-overlay-2", "screen-overlay-2:config", config.screen_overlay_2);
    };

    sendConfig2();

    const unlisten = listen("screen-overlay-2:config-request", () => {
        sendConfig2();
    });

    return () => { unlisten.then((fn) => fn()); };
  }, [config.screen_overlay_2]);

  return (
    <ThemeProvider theme={makeMuiTheme(config.light_mode)}>
      <div className={`relative transition-all duration-500 ${!loaded ? "opacity-0 pointer-events-none" : "opacity-100"} ${!config.light_mode ? "bg-slate-950 text-white" : ""}`}>
        <div className={`transition-all z-20 w-full h-screen flex backdrop-blur-sm bg-transparent justify-center items-center absolute` + (quickstartVisible && lang != null ? " opacity-100" : " opacity-0 pointer-events-none")}>
          <QuickstartMenu config={config} setLang={setLang} lang={lang} setConfig={setConfig}></QuickstartMenu>
        </div>

        <Modal open={updateVisible} size="md" hideClose persistent>
          <div className="flex items-center justify-center p-6 gap-4">
            <CircularProgress />
            <p className="text-2xl">{localization.updating[lang]}</p>
          </div>
        </Modal>

        <Modal open={donateVisible && !quickstartVisible} onClose={() => setDonateVisible(false)} size="md">
          <div className="flex flex-col justify-center p-6 gap-4">
            <div className='flex flex-row justify-center'>
              <p className='text-md text-center'>{localization.donation_text[lang]}</p>
            </div>
            <div className='flex justify-center gap-2'>
              <Button variant="contained" color="secondary" className='w-48' onClick={() => { open("https://buymeacoffee.com/sergiomarquina") }}><Favorite className='mr-2' /><p className='text-xs'>Buy Me a Coffee</p></Button>
              <Button sx={{ backgroundColor: "#fc4d50" }} variant="contained" className='w-48' onClick={() => { invoke("open_url", { url: "https://booth.pm/en/items/6073050" }) }}>
                <img src="/boothlogo.svg" width={24} className="mr-2" />
                <p className='text-xs'>Booth.pm</p>
              </Button>
              <Button variant="contained" className='w-48' onClick={() => { setDonateVisible(false) }}><p className='text-xs'>{localization.close_menu[lang]}</p></Button>
            </div>
          </div>
        </Modal>

        <Modal open={googleServersErrorVisible} onClose={() => setGoogleServersErrorVisible(false)} size="md" z={10}>
          <div className="flex flex-col items-center justify-center p-6 gap-4">
            <p className='text-md text-center'>{localization.unable_to_access_google_servers[lang]}</p>
            <Button variant="contained" className='w-32' onClick={() => { setGoogleServersErrorVisible(false) }}>{localization.close_menu[lang]}</Button>
          </div>
        </Modal>

        <Modal open={settingsVisible} onClose={() => setSettingsVisible(false)} size="lg" title="Settings">
          <SettingsPage lang={lang} config={config} setConfig={setConfig} closeCallback={() => setSettingsVisible(false)} />
        </Modal>
        {!quickstartVisible && changelogsVisible &&
          <div className={'transition-all z-30 w-full h-screen flex backdrop-blur-sm bg-transparent justify-center items-center absolute' + (changelogsVisible ? " opacity-100" : " opacity-0 pointer-events-none")}>
            <div className={`flex flex-col justify-between  w-10/12 h-5/6 outline outline-1 ${config.light_mode ? "outline-slate-400" : "outline-slate-950"} rounded bg-white`}>
              <Changelogs light_mode={config.light_mode} lang={lang} closeCallback={() => setChangelogsVisible(false)} />
            </div>
          </div>
        }

        <div className="flex flex-col h-screen z-0">
          <AppBar position="static">
            <Toolbar>
              <Typography className="flex" variant="h6" component="div" sx={{ flexGrow: 1 }}>
                Kikitan Translator
                <p className="text-sm italic ml-2 mt-2">
                  <a href='' onClick={(e) => {
                    e.preventDefault()

                    setChangelogsVisible(true)
                  }}>v{appVersion}</a>
                </p>
              </Typography>
              <div className='flex'>
                <Select sx={{
                  color: 'white',
                  '& .MuiSvgIcon-root': {
                    color: 'white'
                  }
                }} variant='outlined' className="ml-4 mr-2" value={config.mode} onChange={(e) => {
                  setConfig({ ...config, mode: parseInt(e.target.value.toString()) })
                  setTimeout(() => { setLoaded(false) }, 100)

                  setTimeout(() => { window.location.reload() }, 300)
                }}>
                  <MenuItem value={0}>{localization.translation[lang]}</MenuItem>
                  <MenuItem value={1}>{localization.stt_only[lang]}</MenuItem>
                </Select>
                <IconButton sx={{
                  color: 'white',
                  '& .MuiSvgIcon-root': {
                    color: 'white'
                  }
                }} onClick={() => {
                  setConfig({
                    ...config, light_mode: !config.light_mode
                  })
                }}>
                  {config.light_mode ? <NightsStay /> : <WbSunny />}
                </IconButton>
                <IconButton sx={{
                  color: 'white',
                  '& .MuiSvgIcon-root': {
                    color: 'white'
                  }
                }} onClick={() => { setQuickstartVisible(true); }}>
                  <Translate />
                </IconButton>
                <IconButton sx={{
                  color: 'white',
                  '& .MuiSvgIcon-root': {
                    color: 'white'
                  }
                }} onClick={() => { setSettingsVisible(true) }}>
                  <Settings />
                </IconButton>
              </div>
            </Toolbar>
          </AppBar>
          <div className='flex flex-1 items-center align-middle flex-col mt-8'>
            {loaded && !quickstartVisible && <Kikitan lang={lang} config={config} setConfig={setConfig} settingsVisible={settingsVisible} vrchatRunning={vrchatRunning}></Kikitan>}
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}

export default App
