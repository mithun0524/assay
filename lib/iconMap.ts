/**
 * Icon mapping for Remix Icons
 * Maps icon names to Remix Icon component names
 */

export const ICON_MAP = {
  // Agent icons
  architect: 'RiBuilding2Line',
  coder: 'RiCodeSSlashLine',
  debugger: 'RiToolsLine',
  designer: 'RiPaletteLine',
  tester: 'RiCheckDoubleLine',

  // File type icons
  react: 'RiReactjsLine',
  typescript: 'RiFileCodeLine',
  javascript: 'RiJavascriptLine',
  style: 'RiCss3Line',
  markup: 'RiHtml5Line',
  config: 'RiSettings4Line',
  markdown: 'RiMarkdownLine',
  json: 'RiFileSettingsLine',
  file: 'RiFileTextLine',

  // Action icons
  filesGenerated: 'RiFileAddLine',
  commandsExecuted: 'RiTerminalLine',
  devServer: 'RiRocketLine',

  // Status icons
  success: 'RiCheckLine',
  error: 'RiErrorWarningLine',
  warning: 'RiAlertLine',
  info: 'RiInformationLine',
  loading: 'RiLoader4Line',

  // UI icons
  user: 'RiUser3Line',
  bot: 'RiRobot2Line',
  copy: 'RiClipboardLine',
  check: 'RiCheckLine',
  close: 'RiCloseLine',
  chevronDown: 'RiArrowDownSLine',
  chevronUp: 'RiArrowUpSLine',
  refresh: 'RiRefreshLine',
  sparkles: 'RiSparklingLine',
  github: 'RiGithubLine',
  settings: 'RiSettings3Line',
  download: 'RiDownloadLine',
  folder: 'RiFolderLine',
  undo: 'RiArrowGoBackLine',
  redo: 'RiArrowGoForwardLine',
  upload: 'RiUploadLine',
  palette: 'RiPaletteLine',
  send: 'RiSendPlaneLine',
  stop: 'RiStopFill',
  plus: 'RiAddLine',
  timer: 'RiTimeLine',
  arrowDown: 'RiArrowDownLine',
  paperclip: 'RiAttachmentLine',
  externalLink: 'RiExternalLinkLine',
  key: 'RiKeyLine',
  building: 'RiBuilding2Line',
  code: 'RiCodeLine',
  bug: 'RiBugLine',
  brush: 'RiBrushLine',
  testTube: 'RiTestTubeLine',
  fileCode: 'RiFileCodeLine',
  package: 'RiArchiveLine',
  rocket: 'RiRocketLine',
  checkCircle: 'RiCheckboxCircleLine',
};

export type IconName = keyof typeof ICON_MAP;