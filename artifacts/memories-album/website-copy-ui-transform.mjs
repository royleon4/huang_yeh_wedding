const APP_SUFFIX = "/src/client/App.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Website copy UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

export function websiteCopyUiTransform() {
  return {
    name: "website-copy-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith(APP_SUFFIX)) return null;

      let code = replaceOnce(
        source,
        `import BottomCollectionNav from "./BottomCollectionNav.jsx";`,
        `import BottomCollectionNav from "./BottomCollectionNav.jsx";\nimport { DEFAULT_SITE_COPY, normalizeSiteCopy } from "../site-copy.mjs";\nimport "./site-copy.css";`,
        "public copy imports",
      );

      code = replaceOnce(
        code,
        `  const [galleryError, setGalleryError] = useState(false);`,
        `  const [galleryError, setGalleryError] = useState(false);\n  const [siteCopy, setSiteCopy] = useState(() => normalizeSiteCopy(DEFAULT_SITE_COPY));`,
        "public copy state",
      );

      code = replaceOnce(
        code,
        `  const t = COPY[lang];`,
        `  const t = { ...COPY[lang], ...siteCopy[lang] };`,
        "public copy merge",
      );

      code = replaceOnce(
        code,
        `          setPinnedPhotoIdsByProcess(\n            normalizePinnedPhotosByProcess(settings.pinnedPhotoIdsByProcess),\n          );`,
        `          setPinnedPhotoIdsByProcess(\n            normalizePinnedPhotosByProcess(settings.pinnedPhotoIdsByProcess),\n          );\n          setSiteCopy(normalizeSiteCopy(settings.siteCopy));`,
        "public settings hydration",
      );

      code = replaceOnce(
        code,
        `    document.title =\n      lang === "zh"\n        ? "詠葉婚禮照片檔案館"\n        : "The Leon & YehYeh Wedding Archive";\n  }, [lang]);`,
        `    document.title =\n      String(t.archive ?? "")\n        .replace(/\\s+/g, " ")\n        .trim() ||\n      (lang === "zh"\n        ? "詠葉婚禮照片檔案館"\n        : "The Leon & YehYeh Wedding Archive");\n  }, [lang, t.archive]);`,
        "document title",
      );

      code = replaceOnce(
        code,
        `        <p className="eyebrow">LEON & YEHY · WEDDING ARCHIVE</p>`,
        `        <p className="eyebrow">{t.headerEyebrow}</p>`,
        "header eyebrow",
      );

      return { code, map: null };
    },
  };
}
