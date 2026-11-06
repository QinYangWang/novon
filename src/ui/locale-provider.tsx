"use client";

import * as React from "react"

/**
 * Built-in strings the components show or announce. Strings that carry a value are functions.
 * Every component reads them from the nearest `LocaleProvider`; without one they are English.
 */
type LocaleLabels = {
  wordCount: (count: number) => string
  nights: (count: number) => string
  chatThinking: (kind: "travel" | "code" | "general") => string[]
  chatVerb: (kind: "travel" | "code" | "general") => string
  recommendationOrder: (vendor: React.ReactNode, leadTime: React.ReactNode) => React.ReactNode
  sectionBrand: string
  sectionMuted: string
  variablePlaceholder: string
  calloutDanger: string
  calloutWarning: string
  calloutSuccess: string
  calloutNote: string
  calloutInfo: string
  unmodifiedLines: (count: number) => string
  expandAll: string
  expandLinesUp: string
  expandLinesDown: string
  dayRangeEnd: (day: string, range: number) => string
  dayRangeStart: (day: string, range: number) => string
  dayAvailable: (day: string) => string
  strong: string
  fair: string
  weak: string
  nose: string
  phone: string
  point: string
  waveAndOK: string
  waveAndPoint: string
  wave: string
  waveBothHands: string
  headscarfLong: string
  headscarf: string
  headWrap: string
  paperHat: string
  cap: string
  weekdayLabels: readonly (readonly [string, string])[]
  pleaseAcceptTheTermsToContinue: string
  chooseAPassword: string
  thatDoesntLookLikeAnEmailAddress: string
  enterYourEmailAddress: string
  tellUsWhatToCallYou: string
  copyDayTo: (day: string) => string
  endDayRange: (day: string) => string
  startDayRange: (day: string) => string
  removeDayRange: (start: string, end: string, day: string) => string
  addDayRange: (day: string) => string
  copyDayHours: (day: string) => string
  pullCard: (name: string) => string
  tuckCard: (name: string) => string
  minimumCharacters: (count: number) => string
  filesAdded: (count: number) => string
  largerThan: (size: string) => string
  fileLimit: (count: number) => string
  filesTooLarge: (count: number, size: string) => string
  waitingSize: (size: string) => string
  uploadingCount: (count: number) => string
  uploadingNamed: (name: string) => string
  previewNamed: (name: string) => string
  cancelNamed: (name: string) => string
  removeNamed: (name: string) => string
  retryNamed: (name: string) => string
  closeNamed: (name: string) => string
  stopped: string
  stoppedAfter: (duration: string) => string
  chartSeries: (name: string) => string
  chartItems: (name: string, count: number) => string
  calendarRangeHint: (name: string) => string
  candleHistoryHint: (name: string) => string
  reorderItem: (name: string, position: number, total: number) => string
  itemPosition: (name: string, position: number, total: number) => string
  sortableInstructions: string
  allRowsLoaded: (count: string) => string
  completedTasks: (done: number, total: number) => string
  failedTasks: (count: number) => string
  codeTab: (index: number) => string
  goToSlide: (index: number) => string
  sourceLabel: (index: number | undefined, title: string) => string
  resizeColumn: (name: string) => string
  accountMenu: (name: string) => string
  workspaceSwitch: (name: string) => string
  /* Component and block controls */
  loadingRows: string
  couldNotLoadMoreRows: string
  retry: string
  all: string
  couldNotLoadThisTable: string
  feedbackSendFailed: string
  leftArrowForActions: string
  rightArrowForMoreActions: string
  createYourAccount: string
  startFreeNoCardRequired: string
  createAccount: string
  accountCreated: string
  iAgreeToTheTermsAndPrivacyPolicy: string
  somethingWentWrongPleaseTryAgain: string
  name: string
  email: string
  password: string
  wantMeToPlaceThisRestockOrder: string
  alternatives: string
  selectToAddAnImageURL: string
  edit: string
  preview: string
  sampleData: string
  export: string
  downloadHtml: string
  exportJSON: string
  importJSON: string
  debit: string
  moreOptions: string
  copyCardNumber: string
  hideCardDetails: string
  showCardDetails: string
  exp: string
  tapToTuckAway: string
  tapToPullOut: string
  unavailable: string
  apply: string
  import: string
  exportMDX: string
  moveUp: string
  moveDown: string
  duplicate: string
  viewAll: string
  needsYourApproval: string
  decline: string
  declined: string
  noTabSelected: string
  urlOrVariable: string
  noVariables: string
  noMatchingBlocks: string
  threeColumns: string
  twoColumns: string
  simpleTable: string
  simpleNumberedList: string
  simpleBulletedList: string
  expand: string
  collapse: string
  headingLevel: (level: number) => string
  heading: string
  footerPlaceholder: string
  emailPlaceholder: string
  editorPlaceholder: string
  ran: string
  wrote: string
  editing: string
  edited: string
  reading: string
  read: string
  workingThroughSteps: string
  searchingTheWeb: string
  reasoned: string
  labelThinking: string
  activitySummary: (searches: number, tools: number, steps: number) => string
  callingTool: (name: string) => string
  completedSteps: (count: number) => string
  usedTools: (count: number) => string
  searchedQueries: (count: number, sources: number) => string
  thoughtFor: (duration: string) => string
  statusHistoryHint: (name: string) => string
  legendFor: (name: string) => string
  periodsAgo: (count: number) => string
  uptime: string
  queuedPosition: (position: number) => string
  seedPart: (part: string) => string
  useSeed: (seed: string) => string
  avatarFor: (seed: string) => string
  deselectRow: (row: number) => string
  selectRow: (row: number) => string
  filterSelection: (name: string, count: number) => string
  filterBy: (name: string) => string
  selectedCount: (count: number) => string
  noMatchingItems: (noun: string) => string
  noItemsYet: (noun: string) => string
  rows: string
  amber: string
  uploading: string
  highConfidence: string
  mediumConfidence: string
  lowConfidence: string
  loveIt: string
  good: string
  meh: string
  bad: string
  oncePerItemOfAList: string
  repeat: string
  logic: string
  onlyWhenAVariableIsSet: string
  tintedBoxAroundBlocks: string
  threeAcross: string
  layout: string
  sideBySideContent: string
  smallPrintAddressUnsubscribe: string
  footer: string
  horizontalLine: string
  verticalSpace: string
  brandMark: string
  pictureFromAURLOrUpload: string
  blocks: string
  callToActionLink: string
  insertFirstnameAndFriends: string
  variable: string
  smallHeading: string
  sectionHeading: string
  emailTitle: string
  table: string
  uploadOrPasteAnImage: string
  media: string
  codeWithSyntaxHighlighting: string
  separateSections: string
  divider: string
  makeANoteStandOut: string
  captureAQuote: string
  collapsibleSection: string
  toggle: string
  trackTasksWithCheckboxes: string
  smallSectionHeading: string
  mediumSectionHeading: string
  bigSectionHeading: string
  basicBlocks: string
  plainParagraph: string
  pink: string
  purple: string
  teal: string
  yellow: string
  red: string
  gray: string
  default: string
  codeBlock: string
  quote: string
  todoList: string
  numberedList: string
  bulletedList: string
  heading3: string
  heading2: string
  heading1: string
  noData: string
  maintenance: string
  outage: string
  degraded: string
  operational: string
  gesture: string
  top: string
  beard: string
  glasses: string
  mouth: string
  brows: string
  eyes: string
  hair: string
  male: string
  female: string
  any: string
  violet: string
  rose: string
  orange: string
  green: string
  neutral: string
  blue: string
  draftingAReply: string
  weighingTheOptions: string
  readingTheContext: string
  generationFailed: string
  ready: string
  refiningDetails: string
  generating: string
  queued: string
  pending: string
  /* Component and block controls */
  createWorkspace: string
  workspaces: string
  terminalCommand: string
  loadingMore: string
  loadingMoreRows: string
  deselectAllRows: string
  selectAllRows: string
  altPlusArrowKeysMovesTheColumn: string
  tryAgain: string
  hasChanges: string
  closeTab: string
  statusHistory: string
  today: string
  unknown: string
  status: string
  details: string
  up: string
  down: string
  sortableList: string
  previousOrderRestored: string
  readingProgress: string
  pullToRefresh: string
  releaseToRefresh: string
  refreshing: string
  labelRefreshing: string
  sections: string
  showMore: string
  showLess: string
  couldntFinishThisImage: string
  generatedImage: string
  copyPrompt: string
  generateAgain: string
  download: string
  selectAStartDate: string
  selectAnEndDate: string
  search: string
  tryADifferentSearchOrRemoveAFilter: string
  clearFilters: string
  reset: string
  view: string
  columns: string
  clearFilter: string
  filters: string
  filter: string
  rowActions: string
  source: string
  collapseSheet: string
  expandSheet: string
  dragToClose: string
  variations: string
  seed: string
  userIdEmailOrName: string
  shuffleSeed: string
  shuffle: string
  theSameSeedAlwaysDrawsTheSameAvatar: string
  gender: string
  none: string
  random: string
  downloadSVG: string
  openNavigation: string
  sidebar: string
  navigation: string
  writing: string
  labelWorking: string
  agentActivity: string
  accentColour: string
  feedback: string
  helpUsImprove: string
  shareAnIdeaOrReportABug: string
  thanksForTheFeedback: string
  weReadEveryMessage: string
  closeFeedback: string
  yourFeedback: string
  howDoYouFeel: string
  actions: string
  accept: string
  button: string
  logo: string
  section: string
  plain: string
  rendersItsBlocksOncePerItemOfTheList: string
  rendersItsBlocksOnlyWhenTheVariableIsSetAndNotEmpty: string
  repeatForEach: string
  showIf: string
  listVariable: string
  conditionVariable: string
  alignment: string
  alignLeft: string
  alignCentre: string
  alignRight: string
  image: string
  spacer: string
  deleteBlock: string
  label: string
  buttonLabel: string
  link: string
  buttonLink: string
  style: string
  buttonStyle: string
  filled: string
  outline: string
  corners: string
  square: string
  round: string
  pill: string
  align: string
  colour: string
  buttonColour: string
  imageURL: string
  uploadedImage: string
  uploadImage: string
  altText: string
  describeTheImage: string
  imageLink: string
  optional: string
  width: string
  size: string
  logoSize: string
  height: string
  spacerHeight: string
  emailBody: string
  fillVariablesWithSampleData: string
  device: string
  desktop: string
  mobile: string
  copyHTML: string
  subject: string
  whatIsThisEmailAbout: string
  preheader: string
  previewTextShownAfterTheSubjectInTheInbox: string
  emailPreview: string
  askAnything: string
  attach: string
  voice: string
  closeFolder: string
  labelResults: string
  moreActions: string
  fewerActions: string
  extraActions: string
  whatShouldWeWorkOn: string
  askAnythingOrStartFromOneOfThese: string
  newChat: string
  thinking: string
  agent: string
  conversation: string
  messageTheAgent: string
  onetimeCode: string
  suggestions: string
  document: string
  redo: string
  calloutStyle: string
  callout: string
  keptAsWritten: string
  rawMDX: string
  format: string
  turnInto: string
  text: string
  bold: string
  italic: string
  underline: string
  strikethrough: string
  inlineCode: string
  textColour: string
  background: string
  pasteOrTypeALink: string
  linkURL: string
  applyLink: string
  removeLink: string
  insertBlockBelow: string
  clickToAddBelow: string
  dragToMoveClickForBlockActions: string
  block: string
  theseHoursOverlap: string
  copyToAllDays: string
  copyToWeekdays: string
  notifications: string
  youreAllCaughtUp: string
  dismissNotification: string
  tabs: string
  uploaded: string
  uploadFailed: string
  dragFilesHere: string
  imagesDocumentsAndArchives: string
  attachments: string
  allSynced: string
  releaseToAttach: string
  attachmentLimitReached: string
  add: string
  chooseFiles: string
  closePreview: string
  noMatches: string
  closeSearch: string
  uploadProgress: string
  dropFilesToUpload: string
  browseFiles: string
  releaseToAdd: string
  uploadLimitReached: string
  uploadQueue: string
  /* Overlays and notices */
  close: string
  back: string
  dismiss: string
  /* Fields */
  showPassword: string
  hidePassword: string
  clearSelection: string
  showOptions: string
  remove: string
  clear: string
  selectPlaceholder: string
  pickDate: string
  pickDates: string
  decrease: string
  increase: string
  /* Navigation */
  previousPage: string
  nextPage: string
  pagination: string
  page: (page: number) => string
  pageOf: (page: number, count: number) => string
  rowsPerPage: string
  previousMonth: string
  nextMonth: string
  presets: string
  previousSlide: string
  nextSlide: string
  breadcrumb: string
  showHiddenBreadcrumbs: string
  /* Status */
  loading: string
  working: string
  inProgress: string
  unread: string
  newActivity: string
  copy: string
  copied: string
  copyCode: string
  copyCommand: string
  /* Chat */
  messageFrom: (from: string) => string
  typing: string
  jumpToLatest: string
  newMessages: string
  /* Agents */
  workingFor: (duration: string) => string
  workedFor: (duration: string) => string
  toolRunning: string
  toolDone: string
  toolFailed: string
  toolCancelled: string
  copyOutput: string
  runAgain: string
  streamingOutput: string
  finishedIn: (status: string, duration: string) => string
  sources: string
  plan: string
  copyResponse: string
  regenerate: string
  responseInterrupted: string
  goodResponse: string
  badResponse: string
  /* Composer */
  composerPlaceholder: string
  composerInput: string
  attachFiles: string
  dictate: string
  send: string
  stop: string
  filesAndFolders: string
  files: string
  commands: string
  /* Pickers */
  model: string
  mode: string
  reasoningEffort: string
  select: string
  searchPlaceholder: string
  noResults: string
  showAll: (count: number) => string
  effortLow: string
  effortLowDescription: string
  effortMedium: string
  effortMediumDescription: string
  effortHigh: string
  effortHighDescription: string
  effortExtraHigh: string
  /* Comparison table */
  feature: string
  included: string
  notIncluded: string
  /* Image zoom, banner and diagram */
  enlargeImage: (alt?: string) => string
  zoomIn: string
  zoomOut: string
  announcement: string
  dismissAnnouncement: string
  diagram: string
  openDiagram: string
  diagramError: string
  /* Page navigation */
  onThisPage: string
  backToTop: string
  toggleSection: string
  toggleNamed: (label: string) => string
  /* Command palette */
  commandPalette: string
  searchCommands: string
  commandPlaceholder: string
  commandNoMatches: string
  navigate: string
  open: string
  /* Theme */
  toggleTheme: string
  switchToLightTheme: string
  switchToDarkTheme: string
  themeLight: string
  themeDark: string
  themeSystem: string
  themeCycle: (current: string, next: string) => string
  /* Art */
  coverArt: string
  /* Editable table */
  columnN: (n: number) => string
  columnName: string
  columnHeaderHint: string
  columnOptions: (column: string) => string
  insertBefore: string
  insertAfter: string
  insertColumnAfter: (column: string) => string
  rename: string
  renameNamed: (name: string) => string
  deleteColumn: string
  rowOptions: (row: number) => string
  insertAbove: string
  insertBelow: string
  insertRowBelow: (row: number) => string
  deleteRow: string
  noRows: string
  addFirstRow: string
  newRow: string
  cellLabel: (column: string, row: number) => string
  /* Tool approval */
  allowToolQuestion: string
  permissionRequest: (tool: string) => string
  riskLow: string
  riskMedium: string
  riskHigh: string
  showArguments: string
  hideArguments: string
  deny: string
  alwaysAllow: string
  approve: string
  approved: string
  alwaysAllowed: string
  denied: string
  revoke: string
  undo: string
  /* Files and diffs */
  editedFiles: (count: number) => string
  diffStats: (added: number, removed: number) => string
  review: string
  showFiles: string
  hideFiles: string
  revealFile: (path: string) => string
  diffLayout: string
  diffUnified: string
  diffSplit: string
  writingChanges: string
  copyNewFile: string
  showChanges: string
  hideChanges: string
  changesTo: (file: string) => string
  /* Workspace sidebar */
  workspace: string
  aiWorkspace: string
  bookmarks: string
  collapseSidebar: string
  expandSidebar: string
  searchWorkspace: string
  clearSearch: string
  nothingMatches: (query: string) => string
  /* Colour picker */
  saturationBrightness: string
  saturationBrightnessValue: (saturation: number, brightness: number) => string
  slider2d: string
  hue: string
  opacity: string
  hexColour: string
  /* Charts */
  chart: string
  candlestickChart: string
  compositionChart: string
  donutChart: string
  funnelChart: string
  treemapChart: string
  activityCalendar: string
  total: string
  value: string
  valueIn: (unit: string) => string
  share: string
  shareOfTotal: string
  shareOf: (group: string) => string
  item: string
  segment: string
  description: string
  period: string
  noDataForPeriod: string
  stage: string
  start: string
  ofFirst: string
  ofNamed: (label: string) => string
  ofPrevious: string
  dropOff: string
  stepRate: (percent: string) => string
  ofPreviousPercent: (percent: string) => string
  percentOf: (percent: string, of: string) => string
  chartData: (chart: string) => string
  chartDataShare: (chart: string) => string
  time: string
  priceOpen: string
  priceHigh: string
  priceLow: string
  priceClose: string
  volume: string
  volumeShort: string
  contributions: string
  ofBusiestDay: string
  less: string
  more: string
  activeDays: (active: number, total: number) => string
  inLastWeeks: (weeks: number) => string
  /* Pagination summary */
  results: string
  noItems: (noun: string) => string
  itemRange: (from: string, to: string, total: string, noun: string) => string
}

const en: LocaleLabels = {
  wordCount: (n) => `${n} ${n === 1 ? "word" : "words"}`,
  nights: (n) => `${n} ${n === 1 ? "night" : "nights"}`,
  chatThinking: (kind) => kind === "travel" ? ["Thinking", "Checking your calendar", "Comparing routes"] : kind === "code" ? ["Reading the repo", "Tracing the failure", "Forming a fix"] : ["Thinking", "Reading the context", "Connecting the details"],
  chatVerb: (kind) => kind === "travel" ? "Planning" : kind === "code" ? "Debugging" : "Working",
  recommendationOrder: (vendor, leadTime) => <>Reorder waffle cones from {vendor} with lead time {leadTime}</>,
  sectionBrand: "brand",
  sectionMuted: "muted",
  variablePlaceholder: "variable",
  calloutDanger: "danger",
  calloutWarning: "warning",
  calloutSuccess: "success",
  calloutNote: "note",
  calloutInfo: "info",
  unmodifiedLines: (n) => `${n} unmodified line${n === 1 ? "" : "s"}`,
  expandAll: "Expand all",
  expandLinesUp: "Expand lines above",
  expandLinesDown: "Expand lines below",
  dayRangeEnd: (d, n) => `${d} range ${n} end`,
  dayRangeStart: (d, n) => `${d} range ${n} start`,
  dayAvailable: (d) => `${d} available`,
  strong: "Strong",
  fair: "Fair",
  weak: "Weak",
  nose: "Nose",
  phone: "Phone",
  point: "Point",
  waveAndOK: "Wave and OK",
  waveAndPoint: "Wave and point",
  wave: "Wave",
  waveBothHands: "Wave, both hands",
  headscarfLong: "Headscarf (long)",
  headscarf: "Headscarf",
  headWrap: "Head wrap",
  paperHat: "Paper hat",
  cap: "Cap",
  weekdayLabels: [["Monday", "Mon"], ["Tuesday", "Tue"], ["Wednesday", "Wed"], ["Thursday", "Thu"], ["Friday", "Fri"], ["Saturday", "Sat"], ["Sunday", "Sun"]],
  pleaseAcceptTheTermsToContinue: "Please accept the terms to continue.",
  chooseAPassword: "Choose a password.",
  thatDoesntLookLikeAnEmailAddress: "That doesn't look like an email address.",
  enterYourEmailAddress: "Enter your email address.",
  tellUsWhatToCallYou: "Tell us what to call you.",
  copyDayTo: (d) => `Copy ${d} to…`,
  endDayRange: (d) => `${d} end time`,
  startDayRange: (d) => `${d} start time`,
  removeDayRange: (s, e, d) => `Remove ${s} to ${e} on ${d}`,
  addDayRange: (d) => `Add a range on ${d}`,
  copyDayHours: (d) => `Copy ${d} hours`,
  pullCard: (n) => `Pull ${n} out of its pocket`,
  tuckCard: (n) => `Tuck ${n} into its pocket`,
  minimumCharacters: (n) => `Use at least ${n} characters.`,
  filesAdded: (n) => `${n} file${n === 1 ? "" : "s"} added`,
  largerThan: (s) => `Larger than ${s}`,
  fileLimit: (n) => `You can add up to ${n} files`,
  filesTooLarge: (n, s) => `${n} file${n === 1 ? " is" : "s are"} over ${s}`,
  waitingSize: (s) => `Waiting · ${s}`,
  uploadingCount: (n) => `Uploading ${n}…`,
  uploadingNamed: (n) => `Uploading ${n}`,
  previewNamed: (n) => `Preview ${n}`,
  cancelNamed: (n) => `Cancel ${n}`,
  removeNamed: (n) => `Remove ${n}`,
  retryNamed: (n) => `Retry ${n}`,
  closeNamed: (n) => `Close ${n}`,
  stopped: "Stopped",
  stoppedAfter: (d) => `Stopped after ${d}`,
  chartSeries: (n) => `${n} series`,
  chartItems: (n, c) => `${n}: ${c} items`,
  calendarRangeHint: (n) => `${n}. Arrow keys move between days; Enter starts and ends a range; Shift+arrows extend it.`,
  candleHistoryHint: (n) => `${n}. Use left and right arrow keys to inspect candles.`,
  reorderItem: (n, p, t) => `Reorder ${n}, position ${p} of ${t}`,
  itemPosition: (n, p, t) => `${n}, position ${p} of ${t}.`,
  sortableInstructions: "Drag a handle to reorder. With a handle focused, press Up or Down to move the row, Home or End to move it to the top or bottom.",
  allRowsLoaded: (n) => `All ${n} rows loaded`,
  completedTasks: (d, t) => `${d} of ${t} done`,
  failedTasks: (n) => `${n} failed`,
  codeTab: (n) => `Code ${n}`,
  goToSlide: (n) => `Go to slide ${n}`,
  sourceLabel: (i, t) => `Source ${i ?? ""}: ${t}`.trim(),
  resizeColumn: (n) => `Resize ${n} column`,
  accountMenu: (n) => `Account menu for ${n}`,
  workspaceSwitch: (n) => `Workspace: ${n}. Switch workspace`,
  loadingRows: "Loading rows",
  couldNotLoadMoreRows: "Couldn't load more rows.",
  retry: "Retry",
  all: "All",
  couldNotLoadThisTable: "Couldn't load this table.",
  feedbackSendFailed: "Couldn't send that. Check your connection and retry.",
  leftArrowForActions: "Left arrow for actions",
  rightArrowForMoreActions: "Right arrow for more actions",
  createYourAccount: "Create your account",
  startFreeNoCardRequired: "Start free. No card required.",
  createAccount: "Create account",
  accountCreated: "Account created",
  iAgreeToTheTermsAndPrivacyPolicy: "I agree to the Terms and Privacy Policy",
  somethingWentWrongPleaseTryAgain: "Something went wrong. Please try again.",
  name: "Name",
  email: "Email",
  password: "Password",
  wantMeToPlaceThisRestockOrder: "Want me to place this restock order?",
  alternatives: "Alternatives",
  selectToAddAnImageURL: "Select to add an image URL",
  edit: "Edit",
  preview: "Preview",
  sampleData: "Sample data",
  export: "Export",
  downloadHtml: "Download .html",
  exportJSON: "Export JSON",
  importJSON: "Import JSON",
  debit: "Debit",
  moreOptions: "More options",
  copyCardNumber: "Copy card number",
  hideCardDetails: "Hide card details",
  showCardDetails: "Show card details",
  exp: "Exp",
  tapToTuckAway: "Tap to tuck away",
  tapToPullOut: "Tap to pull out",
  unavailable: "Unavailable",
  apply: "Apply",
  import: "Import",
  exportMDX: "Export MDX",
  moveUp: "Move up",
  moveDown: "Move down",
  duplicate: "Duplicate",
  viewAll: "View all",
  needsYourApproval: "Needs your approval",
  decline: "Decline",
  declined: "Declined",
  noTabSelected: "No tab selected.",
  urlOrVariable: "https:// or {{variable}}",
  noVariables: "No variables",
  noMatchingBlocks: "No matching blocks",
  threeColumns: "3 columns",
  twoColumns: "2 columns",
  simpleTable: "A simple 3 × 3 table",
  simpleNumberedList: "A list with numbering",
  simpleBulletedList: "A simple bulleted list",
  expand: "Expand",
  collapse: "Collapse",
  headingLevel: (n) => `Heading ${n}`,
  heading: "Heading",
  footerPlaceholder: "Footer text, address, unsubscribe link",
  emailPlaceholder: "Write, press '/' for blocks or '{{' for variables…",
  editorPlaceholder: "Write, or press '/' for commands…",
  ran: "Ran",
  wrote: "Wrote",
  editing: "Editing",
  edited: "Edited",
  reading: "Reading",
  read: "Read",
  workingThroughSteps: "Working through steps…",
  searchingTheWeb: "Searching the web…",
  reasoned: "Reasoned",
  labelThinking: "Thinking…",
  activitySummary: (s, t, n) => [s && `${s} ${s === 1 ? "search" : "searches"}`, t && `${t} tool ${t === 1 ? "call" : "calls"}`, n && `${n} ${n === 1 ? "step" : "steps"}`].filter(Boolean).join(", "),
  callingTool: (n) => `Calling ${n}`,
  completedSteps: (n) => `Completed ${n} ${n === 1 ? "step" : "steps"}`,
  usedTools: (n) => `Used ${n} ${n === 1 ? "tool" : "tools"}`,
  searchedQueries: (n, s) => `Searched ${n} ${n === 1 ? "query" : "queries"}${s ? ` · ${s} ${s === 1 ? "source" : "sources"}` : ""}`,
  thoughtFor: (d) => `Thought for ${d}`,
  statusHistoryHint: (n) => `${n}. Use left and right arrow keys to inspect periods.`,
  legendFor: (n) => `${n} legend`,
  periodsAgo: (n) => `${n} periods ago`,
  uptime: "uptime",
  queuedPosition: (n) => `Queued · #${n}`,
  seedPart: (s) => `Seed · ${s}`,
  useSeed: (s) => `Use seed ${s}`,
  avatarFor: (s) => `Avatar for ${s || "empty seed"}`,
  deselectRow: (n) => `Deselect row ${n}`,
  selectRow: (n) => `Select row ${n}`,
  filterSelection: (n, c) => `${n}: ${c} selected`,
  filterBy: (n) => `Filter by ${n}`,
  selectedCount: (n) => `${n} selected`,
  noMatchingItems: (n) => `No matching ${n}`,
  noItemsYet: (n) => `No ${n} yet`,
  rows: "rows",
  amber: "Amber",
  uploading: "Uploading",
  highConfidence: "High confidence",
  mediumConfidence: "Medium confidence",
  lowConfidence: "Low confidence",
  loveIt: "Love it",
  good: "Good",
  meh: "Meh",
  bad: "Bad",
  oncePerItemOfAList: "Once per item of a list",
  repeat: "Repeat",
  logic: "Logic",
  onlyWhenAVariableIsSet: "Only when a variable is set",
  tintedBoxAroundBlocks: "Tinted box around blocks",
  threeAcross: "Three across",
  layout: "Layout",
  sideBySideContent: "Side by side content",
  smallPrintAddressUnsubscribe: "Small print, address, unsubscribe",
  footer: "Footer",
  horizontalLine: "Horizontal line",
  verticalSpace: "Vertical space",
  brandMark: "Brand mark",
  pictureFromAURLOrUpload: "Picture from a URL or upload",
  blocks: "Blocks",
  callToActionLink: "Call to action link",
  insertFirstnameAndFriends: "Insert {{first_name}} and friends",
  variable: "Variable",
  smallHeading: "Small heading",
  sectionHeading: "Section heading",
  emailTitle: "Email title",
  table: "Table",
  uploadOrPasteAnImage: "Upload or paste an image",
  media: "Media",
  codeWithSyntaxHighlighting: "Code with syntax highlighting",
  separateSections: "Separate sections",
  divider: "Divider",
  makeANoteStandOut: "Make a note stand out",
  captureAQuote: "Capture a quote",
  collapsibleSection: "Collapsible section",
  toggle: "Toggle",
  trackTasksWithCheckboxes: "Track tasks with checkboxes",
  smallSectionHeading: "Small section heading",
  mediumSectionHeading: "Medium section heading",
  bigSectionHeading: "Big section heading",
  basicBlocks: "Basic blocks",
  plainParagraph: "Plain paragraph",
  pink: "Pink",
  purple: "Purple",
  teal: "Teal",
  yellow: "Yellow",
  red: "Red",
  gray: "Gray",
  default: "Default",
  codeBlock: "Code block",
  quote: "Quote",
  todoList: "To-do list",
  numberedList: "Numbered list",
  bulletedList: "Bulleted list",
  heading3: "Heading 3",
  heading2: "Heading 2",
  heading1: "Heading 1",
  noData: "No data",
  maintenance: "Maintenance",
  outage: "Outage",
  degraded: "Degraded",
  operational: "Operational",
  gesture: "Gesture",
  top: "Top",
  beard: "Beard",
  glasses: "Glasses",
  mouth: "Mouth",
  brows: "Brows",
  eyes: "Eyes",
  hair: "Hair",
  male: "Male",
  female: "Female",
  any: "Any",
  violet: "Violet",
  rose: "Rose",
  orange: "Orange",
  green: "Green",
  neutral: "Neutral",
  blue: "Blue",
  draftingAReply: "Drafting a reply",
  weighingTheOptions: "Weighing the options",
  readingTheContext: "Reading the context",
  generationFailed: "Generation failed",
  ready: "Ready",
  refiningDetails: "Refining details",
  generating: "Generating",
  queued: "Queued",
  pending: "Pending",
  createWorkspace: "Create workspace",
  workspaces: "Workspaces",
  terminalCommand: "Terminal command",
  loadingMore: "Loading more…",
  loadingMoreRows: "Loading more rows",
  deselectAllRows: "Deselect all rows",
  selectAllRows: "Select all rows",
  altPlusArrowKeysMovesTheColumn: "Alt plus arrow keys moves the column",
  tryAgain: "Try again",
  hasChanges: "Has changes",
  closeTab: "Close tab",
  statusHistory: "Status history",
  today: "Today",
  unknown: "Unknown",
  status: "Status",
  details: "Details",
  up: "Up",
  down: "Down",
  sortableList: "Sortable list",
  previousOrderRestored: "Previous order restored.",
  readingProgress: "Reading progress",
  pullToRefresh: "Pull to refresh",
  releaseToRefresh: "Release to refresh",
  refreshing: "Refreshing…",
  labelRefreshing: "Refreshing",
  sections: "Sections",
  showMore: "Show more",
  showLess: "Show less",
  couldntFinishThisImage: "Couldn’t finish this image.",
  generatedImage: "Generated image",
  copyPrompt: "Copy prompt",
  generateAgain: "Generate again",
  download: "Download",
  selectAStartDate: "Select a start date",
  selectAnEndDate: "Select an end date",
  search: "Search…",
  tryADifferentSearchOrRemoveAFilter: "Try a different search or remove a filter.",
  clearFilters: "Clear filters",
  reset: "Reset",
  view: "View",
  columns: "Columns",
  clearFilter: "Clear filter",
  filters: "Filters",
  filter: "Filter",
  rowActions: "Row actions",
  source: "Source",
  collapseSheet: "Collapse sheet",
  expandSheet: "Expand sheet",
  dragToClose: "Drag to close",
  variations: "Variations",
  seed: "Seed",
  userIdEmailOrName: "User id, email or name",
  shuffleSeed: "Shuffle seed",
  shuffle: "Shuffle",
  theSameSeedAlwaysDrawsTheSameAvatar: "The same seed always draws the same avatar.",
  gender: "Gender",
  none: "None",
  random: "Random",
  downloadSVG: "Download SVG",
  openNavigation: "Open navigation",
  sidebar: "Sidebar",
  navigation: "Navigation",
  writing: "Writing",
  labelWorking: "Working…",
  agentActivity: "Agent activity",
  accentColour: "Accent colour",
  feedback: "Feedback",
  helpUsImprove: "Help us improve",
  shareAnIdeaOrReportABug: "Share an idea or report a bug…",
  thanksForTheFeedback: "Thanks for the feedback!",
  weReadEveryMessage: "We read every message.",
  closeFeedback: "Close feedback",
  yourFeedback: "Your feedback",
  howDoYouFeel: "How do you feel?",
  actions: "Actions",
  accept: "Accept",
  button: "Button",
  logo: "Logo",
  section: "Section",
  plain: "Plain",
  rendersItsBlocksOncePerItemOfTheList: "Renders its blocks once per item of the list",
  rendersItsBlocksOnlyWhenTheVariableIsSetAndNotEmpty: "Renders its blocks only when the variable is set and not empty",
  repeatForEach: "Repeat for each",
  showIf: "Show if",
  listVariable: "List variable",
  conditionVariable: "Condition variable",
  alignment: "Alignment",
  alignLeft: "Align left",
  alignCentre: "Align centre",
  alignRight: "Align right",
  image: "Image",
  spacer: "Spacer",
  deleteBlock: "Delete block",
  label: "Label",
  buttonLabel: "Button label",
  link: "Link",
  buttonLink: "Button link",
  style: "Style",
  buttonStyle: "Button style",
  filled: "Filled",
  outline: "Outline",
  corners: "Corners",
  square: "Square",
  round: "Round",
  pill: "Pill",
  align: "Align",
  colour: "Colour",
  buttonColour: "Button colour",
  imageURL: "Image URL",
  uploadedImage: "Uploaded image",
  uploadImage: "Upload image",
  altText: "Alt text",
  describeTheImage: "Describe the image",
  imageLink: "Image link",
  optional: "Optional",
  width: "Width",
  size: "Size",
  logoSize: "Logo size",
  height: "Height",
  spacerHeight: "Spacer height",
  emailBody: "Email body",
  fillVariablesWithSampleData: "Fill variables with sample data",
  device: "Device",
  desktop: "Desktop",
  mobile: "Mobile",
  copyHTML: "Copy HTML",
  subject: "Subject",
  whatIsThisEmailAbout: "What is this email about?",
  preheader: "Preheader",
  previewTextShownAfterTheSubjectInTheInbox: "Preview text shown after the subject in the inbox",
  emailPreview: "Email preview",
  askAnything: "Ask anything…",
  attach: "Attach",
  voice: "Voice",
  closeFolder: "Close folder",
  labelResults: "Results",
  moreActions: "More actions",
  fewerActions: "Fewer actions",
  extraActions: "Extra actions",
  whatShouldWeWorkOn: "What should we work on?",
  askAnythingOrStartFromOneOfThese: "Ask anything, or start from one of these.",
  newChat: "New chat",
  thinking: "Thinking",
  agent: "Agent",
  conversation: "Conversation",
  messageTheAgent: "Message the agent…",
  onetimeCode: "One-time code",
  suggestions: "Suggestions",
  document: "Document",
  redo: "Redo",
  calloutStyle: "Callout style",
  callout: "Callout",
  keptAsWritten: "kept as written",
  rawMDX: "Raw MDX",
  format: "Format",
  turnInto: "Turn into",
  text: "Text",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strikethrough: "Strikethrough",
  inlineCode: "Inline code",
  textColour: "Text colour",
  background: "Background",
  pasteOrTypeALink: "Paste or type a link",
  linkURL: "Link URL",
  applyLink: "Apply link",
  removeLink: "Remove link",
  insertBlockBelow: "Insert block below",
  clickToAddBelow: "Click to add below",
  dragToMoveClickForBlockActions: "Drag to move, click for block actions",
  block: "Block",
  theseHoursOverlap: "These hours overlap.",
  copyToAllDays: "Copy to all days",
  copyToWeekdays: "Copy to weekdays",
  notifications: "Notifications",
  youreAllCaughtUp: "You're all caught up",
  dismissNotification: "Dismiss notification",
  tabs: "Tabs",
  uploaded: "Uploaded",
  uploadFailed: "Upload failed",
  dragFilesHere: "Drag files here",
  imagesDocumentsAndArchives: "Images, documents and archives",
  attachments: "Attachments",
  allSynced: "All synced",
  releaseToAttach: "Release to attach",
  attachmentLimitReached: "Attachment limit reached",
  add: "Add",
  chooseFiles: "Choose files",
  closePreview: "Close preview",
  noMatches: "No matches.",
  closeSearch: "Close search",
  uploadProgress: "Upload progress",
  dropFilesToUpload: "Drop files to upload",
  browseFiles: "Browse files",
  releaseToAdd: "Release to add",
  uploadLimitReached: "Upload limit reached",
  uploadQueue: "Upload queue",
  close: "Close",
  back: "Back",
  dismiss: "Dismiss",
  showPassword: "Show password",
  hidePassword: "Hide password",
  clearSelection: "Clear selection",
  showOptions: "Show options",
  remove: "Remove",
  clear: "Clear",
  selectPlaceholder: "Select…",
  pickDate: "Pick a date",
  pickDates: "Pick dates",
  decrease: "Decrease",
  increase: "Increase",
  previousPage: "Previous page",
  nextPage: "Next page",
  pagination: "Pagination",
  page: (n) => `Page ${n}`,
  pageOf: (n, count) => `Page ${n} of ${count}`,
  rowsPerPage: "Rows per page",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  presets: "Presets",
  previousSlide: "Previous slide",
  nextSlide: "Next slide",
  breadcrumb: "Breadcrumb",
  showHiddenBreadcrumbs: "Show hidden breadcrumbs",
  loading: "Loading",
  working: "Working",
  inProgress: "In progress",
  unread: "Unread",
  newActivity: "New activity",
  copy: "Copy",
  copied: "Copied",
  copyCode: "Copy code",
  copyCommand: "Copy command",
  messageFrom: (from) => `${from} message`,
  typing: "Typing",
  jumpToLatest: "Jump to latest",
  newMessages: "New messages",
  workingFor: (d) => `Working for ${d}`,
  workedFor: (d) => `Worked for ${d}`,
  toolRunning: "Running",
  toolDone: "Done",
  toolFailed: "Failed",
  toolCancelled: "Cancelled",
  copyOutput: "Copy output",
  runAgain: "Run again",
  streamingOutput: "Streaming output…",
  finishedIn: (status, d) => `${status} in ${d}`,
  sources: "Sources",
  plan: "Plan",
  copyResponse: "Copy response",
  regenerate: "Regenerate",
  responseInterrupted: "The response was interrupted.",
  goodResponse: "Good response",
  badResponse: "Bad response",
  composerPlaceholder: "Ask anything, @tag files/folders, or use / to show available commands",
  composerInput: "Message",
  attachFiles: "Attach files",
  dictate: "Dictate",
  send: "Send",
  stop: "Stop",
  filesAndFolders: "Files and folders",
  files: "Files",
  commands: "Commands",
  model: "Model",
  mode: "Mode",
  reasoningEffort: "Reasoning effort",
  select: "Select",
  searchPlaceholder: "Search",
  noResults: "No results",
  showAll: (n) => `Show all ${n}`,
  effortLow: "Low",
  effortLowDescription: "Fastest, for small edits",
  effortMedium: "Medium",
  effortMediumDescription: "Balanced",
  effortHigh: "High",
  effortHighDescription: "Thinks longer on hard problems",
  effortExtraHigh: "Extra high",
  feature: "Feature",
  included: "Included",
  notIncluded: "Not included",
  enlargeImage: (alt) => (alt ? `Enlarge image: ${alt}` : "Enlarge image"),
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  announcement: "Announcement",
  dismissAnnouncement: "Dismiss announcement",
  diagram: "Diagram",
  openDiagram: "Open diagram full screen",
  diagramError: "Couldn't draw this diagram.",
  onThisPage: "On this page",
  backToTop: "Back to top",
  toggleSection: "Toggle section",
  toggleNamed: (label) => `Toggle ${label}`,
  commandPalette: "Command palette",
  searchCommands: "Search commands",
  commandPlaceholder: "Search or jump to…",
  commandNoMatches: "Nothing matches that.",
  navigate: "Navigate",
  open: "Open",
  toggleTheme: "Toggle theme",
  switchToLightTheme: "Switch to light theme",
  switchToDarkTheme: "Switch to dark theme",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  themeCycle: (current, next) => `Theme: ${current}. Switch to ${next.toLowerCase()}`,
  coverArt: "Abstract cover illustration",
  columnN: (n) => `Column ${n}`,
  columnName: "Column name",
  columnHeaderHint: "Enter renames, Alt plus arrow keys moves the column",
  columnOptions: (c) => `${c} column options`,
  insertBefore: "Insert before",
  insertAfter: "Insert after",
  insertColumnAfter: (c) => `Insert column after ${c}`,
  rename: "Rename",
  renameNamed: (n) => `Rename ${n}`,
  deleteColumn: "Delete column",
  rowOptions: (r) => `Row ${r} options`,
  insertAbove: "Insert above",
  insertBelow: "Insert below",
  insertRowBelow: (r) => `Insert row below row ${r}`,
  deleteRow: "Delete row",
  noRows: "No rows",
  addFirstRow: "Add the first row",
  newRow: "New row",
  cellLabel: (c, r) => `${c}, row ${r}`,
  allowToolQuestion: "Allow this tool to run?",
  permissionRequest: (t) => `Permission request for ${t}`,
  riskLow: "Read only",
  riskMedium: "Makes changes",
  riskHigh: "Destructive",
  showArguments: "Show arguments",
  hideArguments: "Hide arguments",
  deny: "Deny",
  alwaysAllow: "Always allow",
  approve: "Approve",
  approved: "Approved",
  alwaysAllowed: "Always allowed",
  denied: "Denied",
  revoke: "Revoke",
  undo: "Undo",
  editedFiles: (n) => `Edited ${n} ${n === 1 ? "file" : "files"}`,
  diffStats: (a, r) => `${a} additions, ${r} deletions`,
  review: "Review",
  showFiles: "Show files",
  hideFiles: "Hide files",
  revealFile: (p) => `Reveal ${p}`,
  diffLayout: "Diff layout",
  diffUnified: "Unified",
  diffSplit: "Split",
  writingChanges: "Writing changes",
  copyNewFile: "Copy new file contents",
  showChanges: "Show changes",
  hideChanges: "Hide changes",
  changesTo: (f) => `Changes to ${f}`,
  workspace: "Workspace",
  aiWorkspace: "AI workspace",
  bookmarks: "Bookmarks",
  collapseSidebar: "Collapse sidebar",
  expandSidebar: "Expand sidebar",
  searchWorkspace: "Search workspace",
  clearSearch: "Clear search",
  nothingMatches: (q) => `Nothing matches “${q}”.`,
  saturationBrightness: "Saturation and brightness",
  saturationBrightnessValue: (s, b) => `Saturation ${s}%, brightness ${b}%`,
  slider2d: "2D slider",
  hue: "Hue",
  opacity: "Opacity",
  hexColour: "Hex colour",
  chart: "Chart",
  candlestickChart: "Candlestick chart",
  compositionChart: "Composition chart",
  donutChart: "Donut chart",
  funnelChart: "Funnel",
  treemapChart: "Treemap",
  activityCalendar: "Activity calendar",
  total: "Total",
  value: "Value",
  valueIn: (u) => `Value (${u})`,
  share: "Share",
  shareOfTotal: "Share of total",
  shareOf: (g) => `Share of ${g}`,
  item: "Item",
  segment: "Segment",
  description: "Description",
  period: "Period",
  noDataForPeriod: "No data for this period",
  stage: "Stage",
  start: "Start",
  ofFirst: "Of first",
  ofNamed: (l) => `Of ${l}`,
  ofPrevious: "Of previous",
  dropOff: "Drop-off",
  stepRate: (p) => `${p} step`,
  ofPreviousPercent: (p) => `${p} of previous`,
  percentOf: (p, of) => `${p} of ${of.toLowerCase()}`,
  chartData: (c) => `${c} data`,
  chartDataShare: (c) => `${c} data (share of visible series)`,
  time: "Time",
  priceOpen: "Open",
  priceHigh: "High",
  priceLow: "Low",
  priceClose: "Close",
  volume: "Volume",
  volumeShort: "Vol",
  contributions: "contributions",
  ofBusiestDay: "Of busiest day",
  less: "Less",
  more: "More",
  activeDays: (a, t) => `${a}/${t} active days`,
  inLastWeeks: (w) => `in the last ${w} weeks`,
  results: "results",
  noItems: (n) => `No ${n}`,
  itemRange: (f, t, total, n) => `${f}–${t} of ${total} ${n}`,
}

const zhCN: LocaleLabels = {
  wordCount: (n) => `${n} 个词`,
  nights: (n) => `${n} 晚`,
  chatThinking: (kind) => kind === "travel" ? ["正在思考", "正在查看日历", "正在比较路线"] : kind === "code" ? ["正在阅读代码", "正在排查问题", "正在制定修复方案"] : ["正在思考", "正在阅读上下文", "正在整理细节"],
  chatVerb: (kind) => kind === "travel" ? "正在规划" : kind === "code" ? "正在调试" : "正在处理",
  recommendationOrder: (vendor, leadTime) => <>向 {vendor} 补订华夫筒，交货时间为 {leadTime}</>,
  sectionBrand: "品牌",
  sectionMuted: "柔和",
  variablePlaceholder: "变量",
  calloutDanger: "危险",
  calloutWarning: "警告",
  calloutSuccess: "成功",
  calloutNote: "备注",
  calloutInfo: "信息",
  unmodifiedLines: (n) => `${n} 行未修改`,
  expandAll: "展开全部",
  expandLinesUp: "展开上方行",
  expandLinesDown: "展开下方行",
  dayRangeEnd: (d, n) => `${d}第 ${n} 个时段结束时间`,
  dayRangeStart: (d, n) => `${d}第 ${n} 个时段开始时间`,
  dayAvailable: (d) => `${d}可用`,
  strong: "强",
  fair: "一般",
  weak: "弱",
  nose: "鼻子",
  phone: "手机",
  point: "指向",
  waveAndOK: "挥手并比 OK",
  waveAndPoint: "挥手并指向",
  wave: "挥手",
  waveBothHands: "双手挥动",
  headscarfLong: "长头巾",
  headscarf: "头巾",
  headWrap: "包头巾",
  paperHat: "纸帽",
  cap: "帽子",
  weekdayLabels: [["星期一", "周一"], ["星期二", "周二"], ["星期三", "周三"], ["星期四", "周四"], ["星期五", "周五"], ["星期六", "周六"], ["星期日", "周日"]],
  pleaseAcceptTheTermsToContinue: "请先同意条款再继续。",
  chooseAPassword: "请设置密码。",
  thatDoesntLookLikeAnEmailAddress: "请输入有效的邮箱地址。",
  enterYourEmailAddress: "请输入邮箱地址。",
  tellUsWhatToCallYou: "请输入你的姓名。",
  copyDayTo: (d) => `将${d}复制到…`,
  endDayRange: (d) => `${d}结束时间`,
  startDayRange: (d) => `${d}开始时间`,
  removeDayRange: (s, e, d) => `移除${d}的 ${s} 至 ${e} 时段`,
  addDayRange: (d) => `为${d}添加时段`,
  copyDayHours: (d) => `复制${d}的时段`,
  pullCard: (n) => `展开${n}`,
  tuckCard: (n) => `收起${n}`,
  minimumCharacters: (n) => `请至少使用 ${n} 个字符。`,
  filesAdded: (n) => `已添加 ${n} 个文件`,
  largerThan: (s) => `超过 ${s}`,
  fileLimit: (n) => `最多可添加 ${n} 个文件`,
  filesTooLarge: (n, s) => `${n} 个文件超过 ${s}`,
  waitingSize: (s) => `等待中 · ${s}`,
  uploadingCount: (n) => `正在上传 ${n} 个文件…`,
  uploadingNamed: (n) => `正在上传${n}`,
  previewNamed: (n) => `预览${n}`,
  cancelNamed: (n) => `取消${n}`,
  removeNamed: (n) => `移除${n}`,
  retryNamed: (n) => `重试${n}`,
  closeNamed: (n) => `关闭${n}`,
  stopped: "已停止",
  stoppedAfter: (d) => `${d} 后停止`,
  chartSeries: (n) => `${n}系列`,
  chartItems: (n, c) => `${n}：${c} 项`,
  calendarRangeHint: (n) => `${n}。方向键切换日期；回车键开始和结束范围选择；Shift 加方向键扩展范围。`,
  candleHistoryHint: (n) => `${n}。使用左右方向键查看 K 线。`,
  reorderItem: (n, p, t) => `调整${n}的顺序，第 ${p} 项，共 ${t} 项`,
  itemPosition: (n, p, t) => `${n}，第 ${p} 项，共 ${t} 项。`,
  sortableInstructions: "拖动手柄调整顺序。聚焦手柄后，按上下方向键移动行，按 Home 或 End 移至顶部或底部。",
  allRowsLoaded: (n) => `已加载全部 ${n} 行`,
  completedTasks: (d, t) => `已完成 ${d} 项，共 ${t} 项`,
  failedTasks: (n) => `${n} 项失败`,
  codeTab: (n) => `代码 ${n}`,
  goToSlide: (n) => `转到第 ${n} 张`,
  sourceLabel: (i, t) => `来源 ${i ?? ""}：${t}`.trim(),
  resizeColumn: (n) => `调整${n}列宽`,
  accountMenu: (n) => `${n}的账号菜单`,
  workspaceSwitch: (n) => `工作区：${n}。切换工作区`,
  loadingRows: "正在加载行",
  couldNotLoadMoreRows: "无法加载更多行。",
  retry: "重试",
  all: "全部",
  couldNotLoadThisTable: "无法加载此表格。",
  feedbackSendFailed: "发送失败，请检查网络连接后重试。",
  leftArrowForActions: "按左方向键查看操作",
  rightArrowForMoreActions: "按右方向键查看更多操作",
  createYourAccount: "创建账号",
  startFreeNoCardRequired: "免费开始，无需银行卡。",
  createAccount: "创建账号",
  accountCreated: "账号已创建",
  iAgreeToTheTermsAndPrivacyPolicy: "我同意服务条款和隐私政策",
  somethingWentWrongPleaseTryAgain: "出现问题，请重试。",
  name: "姓名",
  email: "邮箱",
  password: "密码",
  wantMeToPlaceThisRestockOrder: "要我提交这笔补货订单吗？",
  alternatives: "其他选项",
  selectToAddAnImageURL: "选择以添加图片地址",
  edit: "编辑",
  preview: "预览",
  sampleData: "示例数据",
  export: "导出",
  downloadHtml: "下载 .html",
  exportJSON: "导出 JSON",
  importJSON: "导入 JSON",
  debit: "借记卡",
  moreOptions: "更多选项",
  copyCardNumber: "复制卡号",
  hideCardDetails: "隐藏卡片详情",
  showCardDetails: "显示卡片详情",
  exp: "有效期",
  tapToTuckAway: "点击收起",
  tapToPullOut: "点击展开",
  unavailable: "不可用",
  apply: "应用",
  import: "导入",
  exportMDX: "导出 MDX",
  moveUp: "上移",
  moveDown: "下移",
  duplicate: "复制一份",
  viewAll: "查看全部",
  needsYourApproval: "需要你的批准",
  decline: "拒绝",
  declined: "已拒绝",
  noTabSelected: "未选择标签页。",
  urlOrVariable: "https:// 或 {{variable}}",
  noVariables: "暂无变量",
  noMatchingBlocks: "没有匹配的块",
  threeColumns: "三列",
  twoColumns: "两列",
  simpleTable: "简单的 3 × 3 表格",
  simpleNumberedList: "带编号的列表",
  simpleBulletedList: "简单无序列表",
  expand: "展开",
  collapse: "收起",
  headingLevel: (n) => `${n} 级标题`,
  heading: "标题",
  footerPlaceholder: "页脚文字、地址、退订链接",
  emailPlaceholder: "输入内容，按 '/' 添加块或 '{{' 添加变量…",
  editorPlaceholder: "输入内容，或按 '/' 使用命令…",
  ran: "已运行",
  wrote: "已写入",
  editing: "正在编辑",
  edited: "已编辑",
  reading: "正在读取",
  read: "已读取",
  workingThroughSteps: "正在逐步处理…",
  searchingTheWeb: "正在搜索网页…",
  reasoned: "已思考",
  labelThinking: "正在思考…",
  activitySummary: (s, t, n) => [s && `${s} 次搜索`, t && `${t} 次工具调用`, n && `${n} 个步骤`].filter(Boolean).join("，"),
  callingTool: (n) => `正在调用 ${n}`,
  completedSteps: (n) => `完成了 ${n} 个步骤`,
  usedTools: (n) => `使用了 ${n} 个工具`,
  searchedQueries: (n, s) => `搜索了 ${n} 个查询${s ? ` · ${s} 个来源` : ""}`,
  thoughtFor: (d) => `思考了 ${d}`,
  statusHistoryHint: (n) => `${n}。使用左右方向键查看时段。`,
  legendFor: (n) => `${n}图例`,
  periodsAgo: (n) => `${n} 个时段前`,
  uptime: "可用率",
  queuedPosition: (n) => `排队中 · 第 ${n} 位`,
  seedPart: (s) => `种子 · ${s}`,
  useSeed: (s) => `使用种子 ${s}`,
  avatarFor: (s) => `${s || "空种子"}的头像`,
  deselectRow: (n) => `取消选择第 ${n} 行`,
  selectRow: (n) => `选择第 ${n} 行`,
  filterSelection: (n, c) => `${n}：已选择 ${c} 项`,
  filterBy: (n) => `按${n}筛选`,
  selectedCount: (n) => `已选择 ${n} 项`,
  noMatchingItems: (n) => `没有匹配的${n}`,
  noItemsYet: (n) => `暂无${n}`,
  rows: "行",
  amber: "琥珀色",
  uploading: "上传中",
  highConfidence: "高置信度",
  mediumConfidence: "中置信度",
  lowConfidence: "低置信度",
  loveIt: "很喜欢",
  good: "不错",
  meh: "一般",
  bad: "不好",
  oncePerItemOfAList: "为列表中的每一项重复",
  repeat: "重复",
  logic: "逻辑",
  onlyWhenAVariableIsSet: "仅在变量已设置时显示",
  tintedBoxAroundBlocks: "带底色的块容器",
  threeAcross: "三列内容",
  layout: "布局",
  sideBySideContent: "并排内容",
  smallPrintAddressUnsubscribe: "附注、地址、退订",
  footer: "页脚",
  horizontalLine: "水平线",
  verticalSpace: "垂直间隔",
  brandMark: "品牌标志",
  pictureFromAURLOrUpload: "通过地址或上传添加图片",
  blocks: "块",
  callToActionLink: "操作链接",
  insertFirstnameAndFriends: "插入 {{first_name}} 等变量",
  variable: "变量",
  smallHeading: "小标题",
  sectionHeading: "章节标题",
  emailTitle: "邮件标题",
  table: "表格",
  uploadOrPasteAnImage: "上传或粘贴图片",
  media: "媒体",
  codeWithSyntaxHighlighting: "带语法高亮的代码",
  separateSections: "分隔章节",
  divider: "分隔线",
  makeANoteStandOut: "突出显示提示",
  captureAQuote: "添加引用",
  collapsibleSection: "可折叠章节",
  toggle: "折叠块",
  trackTasksWithCheckboxes: "使用复选框跟踪任务",
  smallSectionHeading: "小节标题",
  mediumSectionHeading: "中节标题",
  bigSectionHeading: "大节标题",
  basicBlocks: "基础块",
  plainParagraph: "普通段落",
  pink: "粉色",
  purple: "紫色",
  teal: "青色",
  yellow: "黄色",
  red: "红色",
  gray: "灰色",
  default: "默认",
  codeBlock: "代码块",
  quote: "引用",
  todoList: "待办列表",
  numberedList: "有序列表",
  bulletedList: "无序列表",
  heading3: "三级标题",
  heading2: "二级标题",
  heading1: "一级标题",
  noData: "暂无数据",
  maintenance: "维护中",
  outage: "服务中断",
  degraded: "性能下降",
  operational: "正常运行",
  gesture: "手势",
  top: "上衣",
  beard: "胡须",
  glasses: "眼镜",
  mouth: "嘴巴",
  brows: "眉毛",
  eyes: "眼睛",
  hair: "头发",
  male: "男",
  female: "女",
  any: "不限",
  violet: "紫罗兰色",
  rose: "玫瑰色",
  orange: "橙色",
  green: "绿色",
  neutral: "中性",
  blue: "蓝色",
  draftingAReply: "正在起草回复",
  weighingTheOptions: "正在比较选项",
  readingTheContext: "正在阅读上下文",
  generationFailed: "生成失败",
  ready: "已就绪",
  refiningDetails: "完善细节中",
  generating: "生成中",
  queued: "排队中",
  pending: "待处理",
  createWorkspace: "创建工作区",
  workspaces: "工作区",
  terminalCommand: "终端命令",
  loadingMore: "正在加载更多…",
  loadingMoreRows: "正在加载更多行",
  deselectAllRows: "取消选择所有行",
  selectAllRows: "选择所有行",
  altPlusArrowKeysMovesTheColumn: "按 Alt 加方向键移动列",
  tryAgain: "重试",
  hasChanges: "有更改",
  closeTab: "关闭标签页",
  statusHistory: "状态历史",
  today: "今天",
  unknown: "未知",
  status: "状态",
  details: "详情",
  up: "上升",
  down: "下降",
  sortableList: "可排序列表",
  previousOrderRestored: "已恢复先前顺序。",
  readingProgress: "阅读进度",
  pullToRefresh: "下拉刷新",
  releaseToRefresh: "松开刷新",
  refreshing: "正在刷新…",
  labelRefreshing: "正在刷新",
  sections: "章节",
  showMore: "展开",
  showLess: "收起",
  couldntFinishThisImage: "未能生成此图片。",
  generatedImage: "生成的图片",
  copyPrompt: "复制提示词",
  generateAgain: "重新生成",
  download: "下载",
  selectAStartDate: "选择开始日期",
  selectAnEndDate: "选择结束日期",
  search: "搜索…",
  tryADifferentSearchOrRemoveAFilter: "尝试其他搜索词或移除筛选条件。",
  clearFilters: "清除筛选条件",
  reset: "重置",
  view: "视图",
  columns: "列",
  clearFilter: "清除此筛选条件",
  filters: "筛选条件",
  filter: "筛选",
  rowActions: "行操作",
  source: "来源",
  collapseSheet: "收起面板",
  expandSheet: "展开面板",
  dragToClose: "拖动关闭",
  variations: "变体",
  seed: "种子",
  userIdEmailOrName: "用户 ID、邮箱或姓名",
  shuffleSeed: "随机更换种子",
  shuffle: "随机更换",
  theSameSeedAlwaysDrawsTheSameAvatar: "相同的种子始终生成相同的头像。",
  gender: "性别",
  none: "无",
  random: "随机",
  downloadSVG: "下载 SVG",
  openNavigation: "打开导航",
  sidebar: "侧边栏",
  navigation: "导航",
  writing: "正在写入",
  labelWorking: "正在处理…",
  agentActivity: "代理活动",
  accentColour: "强调色",
  feedback: "反馈",
  helpUsImprove: "帮助我们改进",
  shareAnIdeaOrReportABug: "分享想法或报告问题…",
  thanksForTheFeedback: "感谢反馈！",
  weReadEveryMessage: "我们会阅读每条反馈。",
  closeFeedback: "关闭反馈",
  yourFeedback: "你的反馈",
  howDoYouFeel: "你的感受如何？",
  actions: "操作",
  accept: "接受",
  button: "按钮",
  logo: "标志",
  section: "章节",
  plain: "普通",
  rendersItsBlocksOncePerItemOfTheList: "为列表中的每一项显示其中的块",
  rendersItsBlocksOnlyWhenTheVariableIsSetAndNotEmpty: "仅在变量已设置且非空时显示其中的块",
  repeatForEach: "逐项重复",
  showIf: "条件显示",
  listVariable: "列表变量",
  conditionVariable: "条件变量",
  alignment: "对齐方式",
  alignLeft: "左对齐",
  alignCentre: "居中对齐",
  alignRight: "右对齐",
  image: "图片",
  spacer: "间隔",
  deleteBlock: "删除块",
  label: "文字",
  buttonLabel: "按钮文字",
  link: "链接",
  buttonLink: "按钮链接",
  style: "样式",
  buttonStyle: "按钮样式",
  filled: "填充",
  outline: "描边",
  corners: "圆角",
  square: "直角",
  round: "圆角",
  pill: "胶囊",
  align: "对齐",
  colour: "颜色",
  buttonColour: "按钮颜色",
  imageURL: "图片地址",
  uploadedImage: "已上传的图片",
  uploadImage: "上传图片",
  altText: "替代文本",
  describeTheImage: "描述图片内容",
  imageLink: "图片链接",
  optional: "可选",
  width: "宽度",
  size: "尺寸",
  logoSize: "标志尺寸",
  height: "高度",
  spacerHeight: "间隔高度",
  emailBody: "邮件正文",
  fillVariablesWithSampleData: "使用示例数据填充变量",
  device: "设备",
  desktop: "桌面",
  mobile: "手机",
  copyHTML: "复制 HTML",
  subject: "主题",
  whatIsThisEmailAbout: "这封邮件的主题是什么？",
  preheader: "预览文字",
  previewTextShownAfterTheSubjectInTheInbox: "收件箱中显示在主题后的预览文字",
  emailPreview: "邮件预览",
  askAnything: "输入问题…",
  attach: "添加附件",
  voice: "语音",
  closeFolder: "关闭文件夹",
  labelResults: "结果",
  moreActions: "更多操作",
  fewerActions: "收起操作",
  extraActions: "其他操作",
  whatShouldWeWorkOn: "我们要做些什么？",
  askAnythingOrStartFromOneOfThese: "输入问题，或从下列选项开始。",
  newChat: "新对话",
  thinking: "思考中",
  agent: "代理",
  conversation: "对话",
  messageTheAgent: "给代理发送消息…",
  onetimeCode: "一次性验证码",
  suggestions: "建议",
  document: "文档",
  redo: "重做",
  calloutStyle: "提示样式",
  callout: "提示",
  keptAsWritten: "保留原文",
  rawMDX: "原始 MDX",
  format: "格式",
  turnInto: "转换为",
  text: "文本",
  bold: "粗体",
  italic: "斜体",
  underline: "下划线",
  strikethrough: "删除线",
  inlineCode: "行内代码",
  textColour: "文字颜色",
  background: "背景",
  pasteOrTypeALink: "粘贴或输入链接",
  linkURL: "链接地址",
  applyLink: "应用链接",
  removeLink: "移除链接",
  insertBlockBelow: "在下方插入块",
  clickToAddBelow: "点击在下方添加",
  dragToMoveClickForBlockActions: "拖动以移动，点击查看块操作",
  block: "块",
  theseHoursOverlap: "这些时段有重叠。",
  copyToAllDays: "复制到每天",
  copyToWeekdays: "复制到工作日",
  notifications: "通知",
  youreAllCaughtUp: "已查看所有通知",
  dismissNotification: "关闭通知",
  tabs: "标签页",
  uploaded: "已上传",
  uploadFailed: "上传失败",
  dragFilesHere: "将文件拖到此处",
  imagesDocumentsAndArchives: "图片、文档和压缩包",
  attachments: "附件",
  allSynced: "全部已同步",
  releaseToAttach: "松开以添加附件",
  attachmentLimitReached: "附件数量已达上限",
  add: "添加",
  chooseFiles: "选择文件",
  closePreview: "关闭预览",
  noMatches: "没有匹配项。",
  closeSearch: "关闭搜索",
  uploadProgress: "上传进度",
  dropFilesToUpload: "拖放文件以上传",
  browseFiles: "浏览文件",
  releaseToAdd: "松开以添加",
  uploadLimitReached: "上传数量已达上限",
  uploadQueue: "上传队列",
  close: "关闭",
  back: "返回",
  dismiss: "忽略",
  showPassword: "显示密码",
  hidePassword: "隐藏密码",
  clearSelection: "清除选择",
  showOptions: "显示选项",
  remove: "移除",
  clear: "清除",
  selectPlaceholder: "请选择…",
  pickDate: "选择日期",
  pickDates: "选择日期范围",
  decrease: "减少",
  increase: "增加",
  previousPage: "上一页",
  nextPage: "下一页",
  pagination: "分页",
  page: (n) => `第 ${n} 页`,
  pageOf: (n, count) => `第 ${n} / ${count} 页`,
  rowsPerPage: "每页行数",
  previousMonth: "上个月",
  nextMonth: "下个月",
  presets: "预设",
  previousSlide: "上一张",
  nextSlide: "下一张",
  breadcrumb: "路径",
  showHiddenBreadcrumbs: "显示隐藏的路径",
  loading: "加载中",
  working: "处理中",
  inProgress: "进行中",
  unread: "未读",
  newActivity: "有新动态",
  copy: "复制",
  copied: "已复制",
  copyCode: "复制代码",
  copyCommand: "复制命令",
  messageFrom: (from) => `${from} 的消息`,
  typing: "正在输入",
  jumpToLatest: "跳到最新",
  newMessages: "新消息",
  workingFor: (d) => `已工作 ${d}`,
  workedFor: (d) => `工作了 ${d}`,
  toolRunning: "运行中",
  toolDone: "完成",
  toolFailed: "失败",
  toolCancelled: "已取消",
  copyOutput: "复制输出",
  runAgain: "重新运行",
  streamingOutput: "正在输出…",
  finishedIn: (status, d) => `${status}，用时 ${d}`,
  sources: "来源",
  plan: "计划",
  copyResponse: "复制回答",
  regenerate: "重新生成",
  responseInterrupted: "回答中断了。",
  goodResponse: "有帮助",
  badResponse: "没帮助",
  composerPlaceholder: "输入消息，@ 引用文件，/ 使用命令",
  composerInput: "消息",
  attachFiles: "添加文件",
  dictate: "语音输入",
  send: "发送",
  stop: "停止",
  filesAndFolders: "文件和文件夹",
  files: "文件",
  commands: "命令",
  model: "模型",
  mode: "模式",
  reasoningEffort: "思考强度",
  select: "选择",
  searchPlaceholder: "搜索",
  noResults: "没有结果",
  showAll: (n) => `显示全部 ${n} 个`,
  effortLow: "低",
  effortLowDescription: "最快，适合小改动",
  effortMedium: "中",
  effortMediumDescription: "兼顾速度和深度",
  effortHigh: "高",
  effortHighDescription: "难题上想得更久",
  effortExtraHigh: "极高",
  feature: "功能",
  included: "包含",
  notIncluded: "不包含",
  enlargeImage: (alt) => (alt ? `查看大图：${alt}` : "查看大图"),
  zoomIn: "放大",
  zoomOut: "缩小",
  announcement: "公告",
  dismissAnnouncement: "关闭公告",
  diagram: "示意图",
  openDiagram: "全屏查看示意图",
  diagramError: "无法绘制此示意图。",
  onThisPage: "本页目录",
  backToTop: "回到顶部",
  toggleSection: "展开或收起分组",
  toggleNamed: (label) => `展开或收起“${label}”`,
  commandPalette: "命令面板",
  searchCommands: "搜索命令",
  commandPlaceholder: "搜索或跳转到…",
  commandNoMatches: "没有匹配的结果。",
  navigate: "选择",
  open: "打开",
  toggleTheme: "切换主题",
  switchToLightTheme: "切换到浅色主题",
  switchToDarkTheme: "切换到深色主题",
  themeLight: "浅色",
  themeDark: "深色",
  themeSystem: "跟随系统",
  themeCycle: (current, next) => `主题：${current}，切换到${next}`,
  coverArt: "抽象封面插图",
  columnN: (n) => `第 ${n} 列`,
  columnName: "列名",
  columnHeaderHint: "按回车重命名，按 Alt 加方向键移动列",
  columnOptions: (c) => `“${c}”列选项`,
  insertBefore: "在前面插入",
  insertAfter: "在后面插入",
  insertColumnAfter: (c) => `在“${c}”后插入列`,
  rename: "重命名",
  renameNamed: (n) => `重命名“${n}”`,
  deleteColumn: "删除列",
  rowOptions: (r) => `第 ${r} 行选项`,
  insertAbove: "在上方插入",
  insertBelow: "在下方插入",
  insertRowBelow: (r) => `在第 ${r} 行下方插入行`,
  deleteRow: "删除行",
  noRows: "没有数据",
  addFirstRow: "添加第一行",
  newRow: "新建行",
  cellLabel: (c, r) => `${c}，第 ${r} 行`,
  allowToolQuestion: "允许运行这个工具吗？",
  permissionRequest: (t) => `${t} 的权限请求`,
  riskLow: "只读",
  riskMedium: "会修改内容",
  riskHigh: "破坏性操作",
  showArguments: "显示参数",
  hideArguments: "隐藏参数",
  deny: "拒绝",
  alwaysAllow: "始终允许",
  approve: "允许",
  approved: "已允许",
  alwaysAllowed: "已始终允许",
  denied: "已拒绝",
  revoke: "撤销授权",
  undo: "撤销",
  editedFiles: (n) => `编辑了 ${n} 个文件`,
  diffStats: (a, r) => `新增 ${a} 行，删除 ${r} 行`,
  review: "查看",
  showFiles: "显示文件",
  hideFiles: "隐藏文件",
  revealFile: (p) => `定位到 ${p}`,
  diffLayout: "对比布局",
  diffUnified: "合并",
  diffSplit: "并排",
  writingChanges: "正在写入改动",
  copyNewFile: "复制新文件内容",
  showChanges: "显示改动",
  hideChanges: "隐藏改动",
  changesTo: (f) => `${f} 的改动`,
  workspace: "工作区",
  aiWorkspace: "AI 工作区",
  bookmarks: "书签",
  collapseSidebar: "收起侧边栏",
  expandSidebar: "展开侧边栏",
  searchWorkspace: "搜索工作区",
  clearSearch: "清除搜索",
  nothingMatches: (q) => `没有匹配“${q}”的内容。`,
  saturationBrightness: "饱和度和亮度",
  saturationBrightnessValue: (s, b) => `饱和度 ${s}%，亮度 ${b}%`,
  slider2d: "二维滑块",
  hue: "色相",
  opacity: "不透明度",
  hexColour: "十六进制颜色",
  chart: "图表",
  candlestickChart: "K 线图",
  compositionChart: "构成图",
  donutChart: "环形图",
  funnelChart: "漏斗图",
  treemapChart: "矩形树图",
  activityCalendar: "活动日历",
  total: "合计",
  value: "数值",
  valueIn: (u) => `数值（${u}）`,
  share: "占比",
  shareOfTotal: "占总数",
  shareOf: (g) => `占${g}`,
  item: "项目",
  segment: "分段",
  description: "说明",
  period: "时段",
  noDataForPeriod: "这段时间没有数据",
  stage: "阶段",
  start: "起点",
  ofFirst: "占第一步",
  ofNamed: (l) => `占${l}`,
  ofPrevious: "占上一步",
  dropOff: "流失",
  stepRate: (p) => `本步 ${p}`,
  ofPreviousPercent: (p) => `占上一步 ${p}`,
  percentOf: (p, of) => `占${of} ${p}`,
  chartData: (c) => `${c}数据`,
  chartDataShare: (c) => `${c}数据（占可见系列的比例）`,
  time: "时间",
  priceOpen: "开盘",
  priceHigh: "最高",
  priceLow: "最低",
  priceClose: "收盘",
  volume: "成交量",
  volumeShort: "量",
  contributions: "次贡献",
  ofBusiestDay: "占最忙一天",
  less: "少",
  more: "多",
  activeDays: (a, t) => `活跃 ${a}/${t} 天`,
  inLastWeeks: (w) => `（最近 ${w} 周）`,
  results: "结果",
  noItems: (n) => `没有${n}`,
  itemRange: (f, t, total, n) => `${f}–${t}，共 ${total} 个${n}`,
}

/** Built-in label sets, keyed by BCP 47 tag. */
const localeLabels: Record<string, LocaleLabels> = { en, "zh-CN": zhCN }

/** The built-in set for a tag: exact match first, then the language alone (`zh-Hans` → `zh-CN`). */
function labelsFor(locale: string): LocaleLabels | undefined {
  if (localeLabels[locale]) return localeLabels[locale]
  const lang = locale.toLowerCase().split(/[-_]/)[0]
  const key = Object.keys(localeLabels).find((k) => k.toLowerCase().split("-")[0] === lang)
  return key ? localeLabels[key] : undefined
}

type LocaleContextValue = { locale: string; labels: LocaleLabels }

const LocaleContext = React.createContext<LocaleContextValue>({ locale: "en", labels: en })

type LocaleProviderProps = {
  /** BCP 47 tag. Picks a built-in label set when one matches; otherwise the parent's (English at the root) stays. */
  locale?: string
  /** Overrides on top of the locale's set. Anything left out keeps its built-in string. */
  labels?: Partial<LocaleLabels>
  children?: React.ReactNode
}

/** Sets the language of every built-in label below it. Providers nest; the inner one wins per key. */
function LocaleProvider({ locale, labels, children }: LocaleProviderProps) {
  const parent = React.useContext(LocaleContext)
  const value = React.useMemo<LocaleContextValue>(() => {
    const base = (locale && labelsFor(locale)) || parent.labels
    return { locale: locale ?? parent.locale, labels: labels ? { ...base, ...stripUndefined(labels) } : base }
  }, [locale, labels, parent])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

function stripUndefined(labels: Partial<LocaleLabels>) {
  return Object.fromEntries(Object.entries(labels).filter(([, v]) => v !== undefined)) as Partial<LocaleLabels>
}

/** The current locale tag and its labels. */
function useLocale() {
  return React.useContext(LocaleContext)
}

/** Keys whose label is a plain string. */
type LocaleTextKey = { [K in keyof LocaleLabels]: LocaleLabels[K] extends string ? K : never }[keyof LocaleLabels]

/** One built-in label as text, so a component without client code can still show the current locale's string. */
function LocaleText({ label }: { label: LocaleTextKey }) {
  return useLocale().labels[label]
}

export { LocaleProvider, LocaleText, useLocale, localeLabels, type LocaleLabels, type LocaleProviderProps, type LocaleTextKey }
