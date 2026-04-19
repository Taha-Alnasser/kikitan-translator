import * as React from "react"

import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import { appLogDir } from '@tauri-apps/api/path';

import { IconButton, FormControlLabel, FormGroup, Checkbox, TextField, Select, MenuItem, Button, Slider, LinearProgress } from "@mui/material";

import {
    Close,
    History,
    Delete
} from '@mui/icons-material';
import { Config, DEFAULT_CONFIG, speed_presets, ScreenOverlayConfig } from "../util/config";

import { localization } from "../util/localization";
import { DAILY_TOKEN_LIMIT, Lang } from "../util/constants";
import { open } from "@tauri-apps/plugin-shell";

type CustomTabPanelProps = {
    children: React.ReactNode;
    value: number;
    index: number;
} & React.HTMLAttributes<HTMLDivElement>;

function CustomTabPanel(props: CustomTabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    <Typography>{children}</Typography>
                </Box>
            )}
        </div>
    );
}

function a11yProps(index: number) {
    return {
        id: `simple-tab-${index}`,
        'aria-controls': `simple-tabpanel-${index}`,
    };
}

type SettingsProps = {
    closeCallback: () => void;
    config: Config;
    setConfig: (config: Config) => void;
    lang: Lang;
}

export default function Settings({ closeCallback, config, setConfig, lang }: SettingsProps) {
    const [page, setPage] = React.useState(0);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setPage(newValue);
    };

    const clearMessageHistory = () => {
        setConfig({
            ...config,
            message_history: {
                ...config.message_history,
                items: []
            }
        });
    };

    return <>
        <Box sx={{
            width: '100%',
            '& .MuiSvgIcon-root': {
                color: config.light_mode ? 'black' : '#94A3B8'
            },
            '& .MuiOutlinedInput-notchedOutline': {
                borderColor: config.light_mode ? 'black' : 'white',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: config.light_mode ? 'black' : 'white',
            },
            '.MuiTabs-scrollButtons.Mui-disabled': {
                opacity: 0.3
            }

        }} className={`relative w-max h-screen ${config.light_mode ? "" : "bg-slate-950 text-slate-200"}`}>
            <div className="absolute z-10">
                <Box className="flex" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <IconButton className="ml-2 mr-2" onClick={() => { closeCallback(); }}>
                        <Close />
                    </IconButton>
                    <Tabs textColor="inherit" value={page} onChange={handleChange} variant="scrollable" scrollButtons="auto">
                        <Tab label={localization.vrchat_settings[lang]} {...a11yProps(0)} />
                        <Tab label={localization.message_history[lang]} {...a11yProps(1)} />
                        <Tab label={localization.translator_settings[lang]} {...a11yProps(2)} />
                        <Tab label={localization.advanced_settings[lang]} {...a11yProps(3)} />
                        <Tab label="Screen Overlay" {...a11yProps(4)} />
                    </Tabs>
                </Box>
                <CustomTabPanel className="flex" value={page} index={0}>
                    <FormGroup>
                        <FormControlLabel control={<Checkbox checked={config.vrchat_settings.enable_chatbox} onChange={(e) => {
                            setConfig({
                                ...config,
                                vrchat_settings: {
                                    ...config.vrchat_settings,
                                    enable_chatbox: e.target.checked
                                }
                            })
                        }} />} label="Send to VRChat chatbox" />
                        <FormControlLabel control={<Checkbox checked={config.vrchat_settings.translation_first} onChange={(e) => {
                            setConfig({
                                ...config,
                                vrchat_settings: {
                                    ...config.vrchat_settings,
                                    translation_first: e.target.checked
                                }
                            })
                        }} />} label={localization.translation_first[lang]} />
                        <FormControlLabel control={<Checkbox checked={config.vrchat_settings.only_translation} onChange={(e) => {
                            setConfig({
                                ...config,
                                vrchat_settings: {
                                    ...config.vrchat_settings,
                                    only_translation: e.target.checked
                                }
                            })
                        }} />} label={localization.only_send_translation[lang]} />
                        <FormControlLabel control={<Checkbox checked={config.vrchat_settings.send_typing_status_while_talking} onChange={(e) => {
                            setConfig({
                                ...config,
                                vrchat_settings: {
                                    ...config.vrchat_settings,
                                    send_typing_status_while_talking: e.target.checked
                                }
                            })
                        }} />} label={localization.send_typing_while_talking[lang]} />
                        <FormControlLabel className="mb-2" control={<Checkbox checked={config.vrchat_settings.disable_kikitan_when_muted} onChange={(e) => {
                            setConfig({
                                ...config,
                                vrchat_settings: {
                                    ...config.vrchat_settings,
                                    disable_kikitan_when_muted: e.target.checked
                                }
                            })
                        }} />} label={localization.disable_kikitan_when_muted[lang]} />
                        <p className={`mt-2 ${config.light_mode ? "text-black" : "text-slate-400"}`}>{localization.chatbox_update_speed[lang]}</p>
                        <Select sx={{
                            color: config.light_mode ? 'black' : 'white',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: config.light_mode ? 'black' : '#94A3B8',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: config.light_mode ? 'black' : '#94A3B8',
                            },
                        }} MenuProps={{
                            sx: {
                                "& .MuiPaper-root": {
                                    backgroundColor: config.light_mode ? '#94A3B8' : '#020617',
                                }
                            }
                        }} className="mr-4 mt-2 w-32" value={config.vrchat_settings.chatbox_update_speed} onChange={(e) => {
                            setConfig({
                                ...config,
                                vrchat_settings: {
                                    ...config.vrchat_settings,
                                    chatbox_update_speed: parseInt(e.target.value.toString())
                                }
                            })
                        }}>
                            <MenuItem sx={{ color: config.light_mode ? 'black' : 'white' }} value={speed_presets.slow}>{localization.slow[lang]}</MenuItem>
                            <MenuItem sx={{ color: config.light_mode ? 'black' : 'white' }} value={speed_presets.medium}>{localization.medium[lang]}</MenuItem>
                            <MenuItem sx={{ color: config.light_mode ? 'black' : 'white' }} value={speed_presets.fast}>{localization.fast[lang]}</MenuItem>
                        </Select>
                    </FormGroup>
                </CustomTabPanel>
                <CustomTabPanel className="flex" value={page} index={1}>
                    <FormGroup>
                        <FormControlLabel control={<Checkbox checked={config.message_history.enabled} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setConfig({
                                ...config,
                                message_history: {
                                    ...config.message_history,
                                    enabled: e.target.checked
                                }
                            })
                        }} />} label={localization.enable_history[lang]} />

                        <Typography className="mt-4" gutterBottom>
                            {localization.max_history_items[lang]} ({config.message_history.max_items})
                        </Typography>
                        <Slider
                            disabled={!config.message_history.enabled}
                            value={config.message_history.max_items}
                            min={10}
                            max={200}
                            step={10}
                            onChange={(_e: Event, newValue: number | number[]) => {
                                setConfig({
                                    ...config,
                                    message_history: {
                                        ...config.message_history,
                                        max_items: newValue as number
                                    }
                                });
                            }}
                            valueLabelDisplay="auto"
                            sx={{
                                width: 250,
                                color: config.light_mode ? 'rgba(0, 0, 0, 0.87)' : '#94A3B8',
                                '& .MuiSlider-thumb': {
                                    '&:hover, &.Mui-focusVisible': {
                                        boxShadow: '0px 0px 0px 8px rgba(25, 118, 210, 0.16)',
                                    },
                                },
                            }}
                        />

                        <div className="mt-4">
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<Delete />}
                                onClick={clearMessageHistory}
                                disabled={!config.message_history.enabled || config.message_history.items.length === 0}
                                sx={{
                                    backgroundColor: config.light_mode ? undefined : 'rgba(211, 47, 47, 0.8)',
                                    color: '#ffffff',
                                    '&:hover': {
                                        backgroundColor: config.light_mode ? undefined : 'rgba(211, 47, 47, 1)',
                                    },
                                    '&.Mui-disabled': {
                                        backgroundColor: config.light_mode ? undefined : 'rgba(100, 100, 100, 0.2)',
                                        color: config.light_mode ? undefined : 'rgba(255, 255, 255, 0.3)',
                                    }
                                }}
                            >
                                {localization.clear_history[lang]}
                            </Button>
                            <Typography className="mt-2 text-sm" variant="body2" color={config.light_mode ? "textSecondary" : "rgba(255, 255, 255, 0.7)"}>
                                {config.message_history.items.length} {localization.message_history[lang].toLowerCase()}
                            </Typography>
                        </div>
                    </FormGroup>
                </CustomTabPanel>
                <CustomTabPanel className="flex" value={page} index={2}>
                    <FormGroup>
                        <div className="grid grid-rows-1 grid-cols-2 gap-24">
                            <div id="settings">
                                <p className={`mt-2 ${config.light_mode ? "text-black" : "text-slate-400"}`}>{localization.translation_service[lang]}</p>
                                <Select sx={{
                                    color: config.light_mode ? 'black' : 'white',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: config.light_mode ? 'black' : '#94A3B8',
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: config.light_mode ? 'black' : '#94A3B8',
                                    },
                                }} MenuProps={{
                                    sx: {
                                        "& .MuiPaper-root": {
                                            backgroundColor: config.light_mode ? '#94A3B8' : '#020617',
                                        }
                                    }
                                }} className="w-96" value={config.translator_settings.translation_service} onChange={(e) => {
                                    setConfig({
                                        ...config,
                                        translator_settings: {
                                            ...config.translator_settings,
                                            translation_service: parseInt(e.target.value.toString())
                                        }
                                    })
                                }}>
                                    <MenuItem sx={{ color: config.light_mode ? 'black' : 'white' }} value={0}>Google Translate ({localization.default[lang]})</MenuItem>
                                    <MenuItem sx={{ color: config.light_mode ? 'black' : 'white' }} value={1}>Microsoft Bing</MenuItem>
                                    <MenuItem sx={{ color: config.light_mode ? 'black' : 'white' }} value={2}>Groq Llama3.3-70b ({localization.requires_free_api_key[lang]}, {localization.recommended[lang]})</MenuItem>
                                </Select>

                                <p className={`mt-2 ${config.light_mode ? "text-black" : "text-slate-400"}`}>{localization.recognition_service[lang]}</p>
                                <Select sx={{
                                    color: config.light_mode ? 'black' : 'white',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: config.light_mode ? 'black' : '#94A3B8',
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: config.light_mode ? 'black' : '#94A3B8',
                                    },
                                }} MenuProps={{
                                    sx: {
                                        "& .MuiPaper-root": {
                                            backgroundColor: config.light_mode ? '#94A3B8' : '#020617',
                                        }
                                    }
                                }} className="w-96" value={config.translator_settings.recognition_service} onChange={(e) => {
                                    setConfig({
                                        ...config,
                                        translator_settings: {
                                            ...config.translator_settings,
                                            recognition_service: parseInt(e.target.value.toString())
                                        }
                                    })
                                }}>
                                    <MenuItem sx={{ color: config.light_mode ? 'black' : 'white' }} value={0}>Microsoft Bing ({localization.default[lang]})</MenuItem>
                                    <MenuItem sx={{ color: config.light_mode ? 'black' : 'white' }} value={1}>Groq Whisper-Large-V3 ({localization.requires_free_api_key[lang]})</MenuItem>
                                    <MenuItem sx={{ color: config.light_mode ? 'black' : 'white' }} value={2}>WebSpeech ({localization.legacy_not_recommended[lang]})</MenuItem>

                                </Select>
                            </div>
                            <div id="api-keys">
                                <div id="grok-api-key">
                                    <p className={`mt-2 ${config.light_mode ? "text-black" : "text-slate-400"}`}>Groq {localization.api_key[lang]}</p>
                                    <div className="flex gap-2">
                                        <TextField
                                            sx={{
                                                '& .MuiOutlinedInput-root.Mui-disabled': {
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: config.light_mode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(148, 163, 184, 0.4)',
                                                    },
                                                },
                                                '& .MuiInputBase-input.Mui-disabled': {
                                                    WebkitTextFillColor: config.light_mode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(148, 163, 184, 0.5)',
                                                },
                                            }}
                                            slotProps={{
                                                inputLabel: {
                                                    style: { color: config.light_mode ? "black" : '#94A3B8' },
                                                },
                                                htmlInput: {
                                                    style: { color: config.light_mode ? "black" : '#fff' }
                                                }
                                            }}
                                            className="ml-2 mt-2 w-48"
                                            value={config.groq.api_key}
                                            id="outlined-basic"
                                            disabled={(config.translator_settings.translation_service != 2) && (config.translator_settings.recognition_service != 1)}
                                            variant="outlined"
                                            type="password"
                                            color={config.groq.api_key.length == 0 ? "warning" : "primary"}
                                            onChange={(e) => {
                                                setConfig({
                                                    ...config,
                                                    groq: {
                                                        ...config.groq,
                                                        api_key: e.target.value.trim()
                                                    }
                                                })
                                            }}
                                        />
                                        <Button variant="contained" color={config.groq.api_key.length == 0 ? "warning" : "primary"} disabled={(config.translator_settings.translation_service != 2) && (config.translator_settings.recognition_service != 1)} className="w-32 h-14" onClick={async () => {
                                            open("https://console.groq.com/keys")
                                        }}><p className="text-sm">{localization.get_api_key[lang]}</p></Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <FormControlLabel className="mt-2" control={<Checkbox checked={config.translator_settings.desktop_translation} onChange={(e) => {
                            setConfig({
                                ...config,
                                translator_settings: {
                                    ...config.translator_settings,
                                    desktop_translation: e.target.checked
                                }
                            })
                        }} />} label={localization.enable_desktop_capture[lang]} />
                        <div className="flex gap-4">
                            <div>
                                <p className={`mt-2 ${config.light_mode ? "text-black" : "text-slate-400"}`}>{localization.groq_token_usage[lang]}</p>
                                <p>{config.groq.used_tokens}/{DAILY_TOKEN_LIMIT}</p>
                                <LinearProgress variant="determinate" className="w-64" value={(config.groq.used_tokens/DAILY_TOKEN_LIMIT) * 100} />
                            </div>
                            <div className="mt-2">
                                <Button variant="contained" className="w-[110px] h-[52px]" disabled={config.groq.used_tokens == 0} onClick={async () => {
                                setConfig({
                                    ...config,
                                    groq: {
                                        ...config.groq,
                                        used_tokens: 0
                                    }
                                })
                            }}>{localization.reset_usage[lang]}</Button>
                            </div>
                        </div>
                    </FormGroup>
                </CustomTabPanel>
                <CustomTabPanel className="flex" value={page} index={3}>
                    <FormGroup>
                        <Button variant="contained" onClick={async () => {
                            open(await appLogDir())
                        }}>{localization.open_logs[lang]}</Button>
                        <FormControlLabel control={<Checkbox checked={config.data_out.enable_user_data} onChange={(e) => {
                            setConfig({
                                ...config,
                                data_out: {
                                    ...config.data_out,
                                    enable_user_data: e.target.checked
                                }
                            })
                        }} />} label={localization.enable_user_data[lang]} />
                        <FormControlLabel control={<Checkbox checked={config.data_out.enable_desktop_data} onChange={(e) => {
                            setConfig({
                                ...config,
                                data_out: {
                                    ...config.data_out,
                                    enable_desktop_data: e.target.checked
                                }
                            })
                        }} />} label={localization.enable_desktop_data[lang]} />
                    </FormGroup>
                    <FormGroup>
                        <div className="flex transition-all gap-2">
                            <TextField slotProps={{
                                inputLabel: {
                                    style: { color: config.light_mode ? "black" : '#94A3B8' }
                                },
                                htmlInput: {
                                    style: { color: config.light_mode ? "black" : '#fff' }
                                }
                            }} className="mt-2 w-48" value={config.vrchat_settings.osc_address} id="outlined-basic" label={localization.osc_address[lang]} variant="outlined" onChange={(e) => {
                                setConfig({
                                    ...config,
                                    vrchat_settings: {
                                        ...config.vrchat_settings,
                                        osc_address: e.target.value
                                    }
                                })
                            }} />
                            <TextField slotProps={{
                                inputLabel: {
                                    style: { color: config.light_mode ? "black" : '#94A3B8' },
                                },
                                htmlInput: {
                                    style: { color: config.light_mode ? "black" : '#fff' }
                                }
                            }} className="ml-2 mt-2 w-48" value={config.vrchat_settings.osc_port} id="outlined-basic" label={localization.osc_port[lang]} variant="outlined" type="number" onChange={(e) => {
                                setConfig({
                                    ...config,
                                    vrchat_settings: {
                                        ...config.vrchat_settings,
                                        osc_port: parseInt(e.target.value)
                                    }
                                })
                            }} />
                            <IconButton className={"duration-300 ml-2 " + ((config.vrchat_settings.osc_address == DEFAULT_CONFIG.vrchat_settings.osc_address && config.vrchat_settings.osc_port == DEFAULT_CONFIG.vrchat_settings.osc_port) ? "opacity-0" : "opacity-100")} disabled={
                                config.vrchat_settings.osc_address == DEFAULT_CONFIG.vrchat_settings.osc_address &&
                                config.vrchat_settings.osc_port == DEFAULT_CONFIG.vrchat_settings.osc_port}
                                onClick={() => {
                                    setConfig({
                                        ...config,
                                        vrchat_settings: {
                                            ...config.vrchat_settings,
                                            osc_address: DEFAULT_CONFIG.vrchat_settings.osc_address,
                                            osc_port: DEFAULT_CONFIG.vrchat_settings.osc_port
                                        }
                                    })
                                }}>
                                <History />
                            </IconButton>
                        </div>
                    </FormGroup>
                </CustomTabPanel>
                <CustomTabPanel className="flex" value={page} index={4}>
                    <div className={`flex flex-col gap-4 ${config.light_mode ? "text-black" : "text-slate-200"}`}>
                        <p className="text-lg font-semibold">Screen Overlay</p>

                        <FormGroup>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={config.screen_overlay.enabled}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            screen_overlay: { ...config.screen_overlay, enabled: e.target.checked }
                                        })}
                                    />
                                }
                                label="Enable Screen Overlay"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={config.screen_overlay.vrc_only}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            screen_overlay: { ...config.screen_overlay, vrc_only: e.target.checked }
                                        })}
                                    />
                                }
                                label="Only show overlay while VRChat is running"
                            />
                        </FormGroup>

                        <div>
                            <p className="mb-1 text-sm">Corner Position</p>
                            <Select
                                size="small"
                                value={config.screen_overlay.corner}
                                onChange={(e) => setConfig({
                                    ...config,
                                    screen_overlay: { ...config.screen_overlay, corner: e.target.value as ScreenOverlayConfig["corner"] }
                                })}
                                sx={{ color: config.light_mode ? 'black' : 'white', '& .MuiSvgIcon-root': { color: config.light_mode ? 'black' : 'white' } }}
                            >
                                <MenuItem value="bottom-right">Bottom Right</MenuItem>
                                <MenuItem value="bottom-left">Bottom Left</MenuItem>
                                <MenuItem value="top-right">Top Right</MenuItem>
                                <MenuItem value="top-left">Top Left</MenuItem>
                            </Select>
                        </div>

                        <div>
                            <p className="mb-1 text-sm">Transcription Font Size: {config.screen_overlay.transcription_font_size}px</p>
                            <Slider
                                min={12} max={48} step={1}
                                value={config.screen_overlay.transcription_font_size}
                                onChange={(_e, v) => setConfig({
                                    ...config,
                                    screen_overlay: { ...config.screen_overlay, transcription_font_size: v as number }
                                })}
                                sx={{ width: 200 }}
                            />
                        </div>

                        <div>
                            <p className="mb-1 text-sm">Translation Font Size: {config.screen_overlay.font_size}px</p>
                            <Slider
                                min={12} max={48} step={1}
                                value={config.screen_overlay.font_size}
                                onChange={(_e, v) => setConfig({
                                    ...config,
                                    screen_overlay: { ...config.screen_overlay, font_size: v as number }
                                })}
                                sx={{ width: 200 }}
                            />
                        </div>

                        <div>
                            <p className="mb-1 text-sm">Fade Timeout: {config.screen_overlay.fade_timeout}s</p>
                            <Slider
                                min={2} max={20} step={1}
                                value={config.screen_overlay.fade_timeout}
                                onChange={(_e, v) => setConfig({
                                    ...config,
                                    screen_overlay: { ...config.screen_overlay, fade_timeout: v as number }
                                })}
                                sx={{ width: 200 }}
                            />
                        </div>

                        <div>
                            <p className="mb-1 text-sm">Max Lines: {config.screen_overlay.max_lines}</p>
                            <Slider
                                min={1} max={8} step={1}
                                value={config.screen_overlay.max_lines}
                                onChange={(_e, v) => setConfig({
                                    ...config,
                                    screen_overlay: { ...config.screen_overlay, max_lines: v as number }
                                })}
                                sx={{ width: 200 }}
                            />
                        </div>

                        <div>
                            <p className="mb-1 text-sm">Translation Text Color</p>
                            <TextField
                                size="small"
                                value={config.screen_overlay.text_color}
                                onChange={(e) => setConfig({
                                    ...config,
                                    screen_overlay: { ...config.screen_overlay, text_color: e.target.value }
                                })}
                                placeholder="#ffffff"
                                sx={{ input: { color: config.light_mode ? 'black' : 'white' }, width: 140 }}
                            />
                        </div>

                        <div>
                            <p className="mb-1 text-sm">Transcription Text Color</p>
                            <TextField
                                size="small"
                                value={config.screen_overlay.transcription_color}
                                onChange={(e) => setConfig({
                                    ...config,
                                    screen_overlay: { ...config.screen_overlay, transcription_color: e.target.value }
                                })}
                                placeholder="#60a5fa"
                                sx={{ input: { color: config.light_mode ? 'black' : 'white' }, width: 140 }}
                            />
                        </div>
                    </div>
                </CustomTabPanel>
            </div>
        </Box>
    </>
}