// Extension database with IDs and detectable resources
// Source: https://github.com/abrahamjuliot/creepjs/issues/106

export interface ExtensionSignature {
  id: string;
  name: string;
  file: string; // web_accessible_resource to test
}

export const KNOWN_EXTENSIONS: ExtensionSignature[] = [
  // === Password Managers ===
  { id: 'hdokiejnpimakedhajhdlcegeplioahd', name: 'LastPass', file: 'images/icon.png' },
  { id: 'nngceckbapebfimnlniiiahkandclblb', name: 'Bitwarden', file: 'images/icon-38.png' },
  { id: 'pnlccmojcmeohlpggmfnbbiapkmbliob', name: '1Password', file: 'vendor/webfonts/onepassword-icons.svg' },
  { id: 'bhmmomiinigofkjcapegjjndpbikblnp', name: 'Dashlane', file: 'img/icons/icon_48.png' },
  
  // === Grammar & Writing Tools ===
  { id: 'cnlefmmeadmemmdciolhbnfeacpdfbkd', name: 'Grammarly: AI Writing and Grammar Checker App', file: 'src/css/Grammarly.styles.css' }, // Edge version
  { id: 'kbfnbcaeplbcioakkpcpgfkobkghlhen', name: 'Grammarly', file: 'src/css/Grammarly.styles.css' }, // Chrome version
  
  // === ChatGPT & AI Helpers (HIGH RISK for exams) ===
  { id: 'jmlaanjgllfidfhohpempmalomfpjbjj', name: 'ChatGPT for Google', file: 'logo.png' },
  { id: 'ehahfjglogdhjdhdkjgfjieegehlpaik', name: 'Monica - ChatGPT Copilot', file: 'icons/icon128.png' },
  { id: 'flnddbfjnbhakjmficekchhohjomaiokh', name: 'ChatGPT Writer', file: 'icons/icon128.png' },
  { id: 'bpggmmljdiliancllaapiggllnkbjocb', name: 'WebChatGPT', file: 'icons/icon-128.png' },
  { id: 'kcebgoaiidgifejmdgcfmlhgfnmianji', name: 'ChatGPT Prompt Genius', file: 'icons/icon128.png' },
  { id: 'gihmmpiobklfepjocnamgkkbiglidom', name: 'ChatGPT Chrome Extension', file: 'icons/icon.png' },
  { id: 'cdjifpfganmhoojfclednjdnnpooaojb', name: 'ChatGPT - Prompt Genius', file: 'icon128.png' },
  { id: 'nhakmhliiohdkdiikbkicnbpmfbpnhnm', name: 'ChatGPT Sidebar', file: 'icons/icon128.png' },
  
  // === Translation Tools ===
  { id: 'aapbdbdomjkkjkaonfhkkikfgjllcleb', name: 'Google Translate', file: 'popup_css_compiled.css' },
  { id: 'ghbmnnjooekpmoecnnnilnnbdlolhkhi', name: 'Google Dictionary', file: 'img/icon-16.png' },
  
  // === Ad Blockers ===
  { id: 'cfhdojbkjhnklbpkdaibdccddilifddb', name: 'Adblock Plus', file: 'skin/icons/abp-16.png' },
  { id: 'cjpalhdlnbpafiamejdnhcphjbkeiagm', name: 'uBlock Origin', file: 'img/icon_128.png' },
  { id: 'gighmmpiobklfepjocnamgkkbiglidom', name: 'AdBlock', file: 'icons/icon.png' },
  
  // === Shopping & Coupons ===
  { id: 'bkdgflcldnnnapblkhphbgpggdiikppg', name: 'Honey', file: 'static/images/logo.svg' },
  { id: 'jopfmidmlamdofpklpgmejkleemgihfb', name: 'Rakuten', file: 'img/icon128.png' },
  
  // === Developer Tools ===
  { id: 'fmkadmapgofadopljbjfkapdkoienihi', name: 'React Developer Tools', file: 'main.html' },
  { id: 'lmhkpmbekcpmknklioeibfkpmmfibljd', name: 'Redux DevTools', file: 'window.html' },
  { id: 'cjhilnbmhfdbkbcejcojliejhcpgfnio', name: 'Postman Interceptor', file: 'icon.png' },
  { id: 'hdokiejnpimakedhajhdlcegeplioahd', name: 'EditThisCookie', file: 'icons/icon16.png' },
  
  // === Screenshot & Recording Tools (HIGH RISK) ===
  { id: 'hfaciehifhdcgoolaejkoncjciicbemc', name: 'GoFullPage - Full Page Screen Capture', file: 'icon.png' }, // Edge version
  { id: 'fdpohaocaechififmbbbbbknoalclacl', name: 'GoFullPage - Full Page Screen Capture', file: 'icon.png' }, // Chrome version
  { id: 'ckejmhbmlajgoklhgbapkiccekfoccmk', name: 'Awesome Screenshot', file: 'images/icon16.png' },
  { id: 'bfbmjmiodbnnpllbbbfblcplfjjepjdn', name: 'Nimbus Screenshot & Screen Video Recorder', file: 'images/icon16.png' },
  { id: 'mmeijimgabbpbgpdklnllpncmdofkcpn', name: 'Screencastify', file: 'icon16.png' },
  { id: 'jlmpjdjjbgclbocgajdjefcidcncaied', name: 'Loom', file: 'icon16.png' },
  
  // === Responsive Design Tools ===
  { id: 'iedmgngpbobnofibfaniioeobecbpkdn', name: 'Responsive viewer For Edge', file: 'icon.png' }, // Edge version
  { id: 'hkelihkpggjbkmggidgagbkjokfnaknh', name: 'Responsive Viewer For Edge', file: 'icon.png' }, // Chrome version
  { id: 'inmopeiepgfljkpkidclfgbgbmfcennb', name: 'Mobile Simulator', file: 'images/icon16.png' },
  
  // === Privacy & VPN Tools (HIGH RISK - can hide location) ===
  { id: 'mlomiejdfkolichcflejclcbmpeaniij', name: 'Ghostery', file: 'app/images/icon.png' },
  { id: 'gcknhkkoolaabfmlnjonogaaifnjlfnp', name: 'FoxyProxy', file: 'images/icon16.png' },
  { id: 'oocalimimngaihdkbihfgmpkcpnmlaoa', name: 'TunnelBear VPN', file: 'images/icon16.png' },
  { id: 'hdokiejnpimakedhajhdlcegeplioahd', name: 'Hola VPN', file: 'img/icon16.png' },
  
  // === Tab Management ===
  { id: 'dbepggeogbaibhgnhhndojpepiihcmeb', name: 'Vimium', file: 'icons/vimium.svg' },
  { id: 'hjdoplcnndgiblooccencgcggcoihigg', name: 'Tab Manager Plus', file: 'images/browsers.png' },
  
  // === Dark Mode & Themes ===
  { id: 'eimadpbcbfnmbkopoojfekhnkhdbieeh', name: 'Dark Reader', file: 'ui/assets/icon.svg' },
  { id: 'bkdgflcldnnnapblkhphbgpggdiikppg', name: 'Stylus', file: 'icons/icon.png' },
  
  // === Productivity Tools ===
  { id: 'hdokiejnpimakedhajhdlcegeplioahd', name: 'Evernote Web Clipper', file: 'images/icon16.png' },
  { id: 'klbibkeccnjlkjkiokjodocebajanakg', name: 'Great Suspender', file: 'img/icon16.png' },
  { id: 'ennpfpdlaclocpomkiablnmbppdnlhoh', name: 'Toby for Chrome', file: 'assets/icon16.png' },
  
  // === Video Download Tools (HIGH RISK) ===
  { id: 'elicpjhcidhpjomhibiffojpinpmmpil', name: 'Video DownloadHelper', file: 'icon.png' },
  { id: 'jmkaglaafmhbcpleggkmaliipiilheln', name: 'Flash Video Downloader', file: 'images/icon16.png' },
  
  // === OCR & Text Recognition (HIGH RISK for exams) ===
  { id: 'bjfhmglciegochdpefhhlphglcehbmek', name: 'Copyfish OCR', file: 'images/icon16.png' },
  { id: 'bfnaelmomeimhlpmgjnjophhpkkoljpa', name: 'Project Naptha', file: 'icon16.png' },
  
  // === Auto-fill & Form Tools ===
  { id: 'hifnmfgfdfchmdjafekindomndjekfnh', name: 'AutoFill', file: 'icon16.png' },
  { id: 'jdbnofccmhefkmjbkkdkfiicjkgofkdh', name: 'Roboform', file: 'images/icon16.png' },
  
  // === Math & Calculation Tools (HIGH RISK for math exams) ===
  { id: 'dboiomgdmhcjbmofdofhfhffdbhnblch', name: 'Desmos Calculator', file: 'icon16.png' },
  { id: 'dmackncgmlckpclodnpjmpbjajkkceig', name: 'Wolfram Alpha', file: 'icon16.png' },
  { id: 'cdmbpciicdjobdpkhgojnmhfgehbbhhm', name: 'Symbolab', file: 'icon16.png' },
  
  // === Inspection & Element Picker Tools ===
  { id: 'gbmdgpbipfallnflgajpaliibnhdgobh', name: 'JSON Viewer', file: 'icons/icon16.png' },
  { id: 'fhhdlnnepfjhlhilgmeepgkhjmhhhjkh', name: 'Octotree', file: 'icons/icon16.png' },
  
  // === Session & Cookie Managers ===
  { id: 'iaiomicjabeggjcfkbimgmglanimpnae', name: 'Session Buddy', file: 'img/icon16.png' },
  { id: 'fngmhnnpilhplaeedifhccceomclgfbg', name: 'EditThisCookie', file: 'icons/icon16.png' },
  
  // === User-Specific Extensions (Added from edge://extensions) ===
  { id: 'kjchkpkjpiloipaonppkmepcbhcncedo', name: 'Adobe Photoshop', file: 'icon.png' },
  { id: 'kiilhncajadbgbmdbdcopdpnmdhlbdle', name: 'CRXLauncher', file: 'icon.png' },
  { id: 'fdhgeoginicibhagdmblfikbgbkahibd', name: 'McAfee® WebAdvisor', file: 'icon.png' },
  { id: 'ghbmnnjooekpmoecnnnilnnbdlolhkhi', name: 'Google Docs Offline', file: 'icon.png' },
];

// Helper function to check if an extension ID is in the database
export function isKnownExtension(extensionId: string): boolean {
  return KNOWN_EXTENSIONS.some(ext => ext.id === extensionId);
}

// Get extension info by ID
export function getExtensionInfo(extensionId: string): ExtensionSignature | undefined {
  return KNOWN_EXTENSIONS.find(ext => ext.id === extensionId);
}
