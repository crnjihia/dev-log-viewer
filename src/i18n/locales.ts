// path: src/i18n/locales.ts

import { Locale } from '../types';

export interface Translations {
  appName: string;
  openFile: string;
  jumpToLine: string;
  jumpModalTitle: string;
  jumpPlaceholder: string;
  jumpButton: string;
  cancel: string;
  wordWrap: string;
  wrappingOn: string;
  wrappingOff: string;
  indexing: string;
  indexingComplete: string;
  lines: string;
  selectedLine: string;
  truncated: string;
  encoding: string;
  timezone: string;
  copySuccess: string;
  noFileLoaded: string;
  noFileDesc: string;
  dropFileHere: string;
  fileSize: string;
  switchLanguage: string;
  line: string;
  structuredSearch: string;
  queryPlaceholder: string;
  fieldPicker: string;
  sideInspector: string;
  copyJson: string;
  parsedJson: string;
  rawText: string;
  filterByValue: string;
  columns: string;
  syntaxError: string;
  fieldsSampled: string;
  noFieldsFound: string;
  clearFilter: string;
  liveTail: string;
  followOn: string;
  followOff: string;
  presets: string;
  presetsPalette: string;
  savePreset: string;
  presetName: string;
  presetDesc: string;
  save: string;
  delete: string;
  apply: string;
  filterOnlyMatchingDesc: string;
  logTruncated: string;
  logRotated: string;
  commandPalette: string;
  commandsSearch: string;
  theme: string;
  themeDark: string;
  themeLight: string;
  themeHighContrast: string;
  themeKenyanDusk: string;
  customTheme: string;
  keymapMode: string;
  vimMode: string;
  standardMode: string;
  importTheme: string;
  applyTheme: string;
  navigation: string;
  actions: string;
  filters: string;
}

export const translations: Record<Locale, Translations> = {
  en: {
    appName: "Dev Log Viewer",
    openFile: "Open Log File",
    jumpToLine: "Jump to Line",
    jumpModalTitle: "Jump to Line Number",
    jumpPlaceholder: "Enter line number (e.g. 45000)...",
    jumpButton: "Jump",
    cancel: "Cancel",
    wordWrap: "Wrap Lines",
    wrappingOn: "Wrap: ON",
    wrappingOff: "Wrap: OFF",
    indexing: "Indexing",
    indexingComplete: "Indexed",
    lines: "lines",
    selectedLine: "Selected Line",
    truncated: "TRUNCATED",
    encoding: "Encoding",
    timezone: "Nairobi (EAT / UTC+3)",
    copySuccess: "Line copied to clipboard",
    noFileLoaded: "No log file opened",
    noFileDesc: "Open a multi-gigabyte log or sample file to begin instant streaming.",
    dropFileHere: "Drop .log or .jsonl file here",
    fileSize: "Size",
    switchLanguage: "Badili hadi Kiswahili",
    line: "Line",
    structuredSearch: "JSON Filter",
    queryPlaceholder: "Filter (e.g. level:error AND duration_ms>500)...",
    fieldPicker: "Fields",
    sideInspector: "Line Inspector",
    copyJson: "Copy JSON",
    parsedJson: "Formatted JSON",
    rawText: "Raw Text",
    filterByValue: "Filter by this value",
    columns: "Columns",
    syntaxError: "Syntax Error",
    fieldsSampled: "fields sampled",
    noFieldsFound: "No JSON fields found in sample lines",
    clearFilter: "Clear Filter",
    liveTail: "Live Tail",
    followOn: "Follow: ON",
    followOff: "Follow: OFF",
    presets: "Presets",
    presetsPalette: "Filter Presets & Quick Switch",
    savePreset: "Save Query as Preset",
    presetName: "Preset Title",
    presetDesc: "Description (optional)",
    save: "Save",
    delete: "Delete",
    apply: "Apply",
    filterOnlyMatchingDesc: "Displaying matching lines only",
    logTruncated: "Log file truncated: re-indexed from start",
    logRotated: "Log file rotated: connected to fresh stream",
    commandPalette: "Command Palette",
    commandsSearch: "Type a command or shortcut...",
    theme: "Theme",
    themeDark: "Obsidian Dark",
    themeLight: "Daylight Clean",
    themeHighContrast: "High Contrast (WCAG AAA)",
    themeKenyanDusk: "Kenyan Dusk",
    customTheme: "Custom Theme JSON",
    keymapMode: "Keymap",
    vimMode: "Vim Keys",
    standardMode: "Standard Keys",
    importTheme: "Import Custom Theme",
    applyTheme: "Apply Theme",
    navigation: "Navigation",
    actions: "Actions",
    filters: "Filters",
  },
  sw: {
    appName: "Kitazamaji cha Kumbukumbu (Dev Log Viewer)",
    openFile: "Fungua Faili ya Kumbukumbu",
    jumpToLine: "Rukia Mstari",
    jumpModalTitle: "Rukia Nambari ya Mstari",
    jumpPlaceholder: "Ingiza nambari ya mstari (mfano 45000)...",
    jumpButton: "Rukia",
    cancel: "Ghairi",
    wordWrap: "Kunja Mistari",
    wrappingOn: "Kukunja: IMEWASHWA",
    wrappingOff: "Kukunja: IMEZIMWA",
    indexing: "Inaorodhesha",
    indexingComplete: "Imeorodheshwa",
    lines: "mistari",
    selectedLine: "Mstari Uliochaguliwa",
    truncated: "IMEKATWA",
    encoding: "Usimbaji",
    timezone: "Nairobi (Saa za Afrika Mashariki EAT)",
    copySuccess: "Mstari umenakiliwa",
    noFileLoaded: "Hakuna faili iliyofunguliwa",
    noFileDesc: "Fungua faili kubwa ya kumbukumbu kuanza uchambuzi wa haraka papo hapo.",
    dropFileHere: "Buruta faili ya .log au .jsonl hapa",
    fileSize: "Ukubwa",
    switchLanguage: "Switch to English",
    line: "Mstari",
    structuredSearch: "Chujio la JSON",
    queryPlaceholder: "Chuja (mfano level:error NA duration_ms>500)...",
    fieldPicker: "Nyanja",
    sideInspector: "Mkaguzi wa Mstari",
    copyJson: "Nakili JSON",
    parsedJson: "JSON Iliyopangiliwa",
    rawText: "Maandishi Halisi",
    filterByValue: "Chuja kwa thamani hii",
    columns: "Safu Wima",
    syntaxError: "Hitilafu ya Muundo",
    fieldsSampled: "nyanja zilizogunduliwa",
    noFieldsFound: "Hakuna nyanja za JSON zilizopatikana kwenye sampuli",
    clearFilter: "Futa Kichujio",
    liveTail: "Ufuatiliaji Papo Hapo",
    followOn: "Fuata: IMEWASHWA",
    followOff: "Fuata: IMEZIMWA",
    presets: "Violezo",
    presetsPalette: "Violezo vya Vichujio na Kubadili Haraka",
    savePreset: "Hifadhi Hoja kama Kiolezo",
    presetName: "Kichwa cha Kiolezo",
    presetDesc: "Maelezo (hiari)",
    save: "Hifadhi",
    delete: "Futa",
    apply: "Tumia",
    filterOnlyMatchingDesc: "Inaonyesha mistari inayolingana tu",
    logTruncated: "Faili imefupishwa: imeanza upya",
    logRotated: "Faili imezungushwa: imeunganishwa upya",
    commandPalette: "Orodha ya Amri",
    commandsSearch: "Andika amri au mkato...",
    theme: "Mandhari",
    themeDark: "Giza la Obsidian",
    themeLight: "Mwangaza Safi",
    themeHighContrast: "Tofauti Kubwa (WCAG AAA)",
    themeKenyanDusk: "Machweo ya Kenya",
    customTheme: "Mandhari ya JSON",
    keymapMode: "Kibodi",
    vimMode: "Mtindo wa Vim",
    standardMode: "Mtindo wa Kawaida",
    importTheme: "Ingiza Mandhari ya JSON",
    applyTheme: "Tumia Mandhari",
    navigation: "Uelekezaji",
    actions: "Vitendo",
    filters: "Vichujio",
  },
};
