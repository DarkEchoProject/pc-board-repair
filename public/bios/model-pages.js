const modelPages = [
  {
    href: "/bios/hp-prodesk-400-ms-7860",
    title: "HP ProDesk 400 — MS-7860",
    archives: [
      ["474af1d5b65cc4c52fbc343f608f844981e17740d684ef9124ff87e51409cbdb", "h81-004"],
      ["ae64e5abd854277216ce15c71c325a8cd793c1d430890e29db2708b08fae6e4d", "h87-004"],
    ],
    boardKeys: ["1wpm2a0", "mqexo", "1c1haig", "s53c57"],
  },
  {
    href: "/bios/dell-xps-15-9550-la-c361p",
    title: "Dell XPS 15 9550 — LA-C361P",
    archives: [
      ["d9886f41d71fcd516d6a4cd888eb69114bd17d67de5a5758c8af7f6d5d1f49d8", "archive"],
    ],
    boardKeys: ["qy3juv", "xidxjm"],
  },
];

const archivePages = new Map();
const boardPages = new Map();

for (const { href, title, archives, boardKeys } of modelPages) {
  for (const [sha256, fragment] of archives) archivePages.set(sha256, `${href}#${fragment}`);
  const page = { href, title };
  for (const key of boardKeys) boardPages.set(key, page);
}

export function biosArchivePage(sha256) {
  return archivePages.get(String(sha256 ?? "").toLowerCase());
}

export function biosModelForBoard(key) {
  return boardPages.get(key);
}
