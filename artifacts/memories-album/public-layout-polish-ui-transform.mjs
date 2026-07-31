const APP_SUFFIX = "/src/client/App.jsx";
const STYLES_SUFFIX = "/src/client/styles.css";

const BOTANICAL_RULE = `        <div className="botanical-rule" aria-hidden="true">
          <span>❧</span>
        </div>
`;

const COMPACT_HERO_CSS = `

/* Keep the mobile introduction compact after removing the decorative rule. */
.archive-header {
  padding: 4.7rem 1.1rem 1.35rem;
}

.archive-date {
  margin: 0.9rem 0 0;
}

.archive-subtitle {
  margin-top: 0.55rem;
  line-height: 1.65;
}

.archive-subtitle:empty {
  display: none;
}

@media (max-width: 600px) {
  .archive-header {
    padding: 4.55rem 1rem 1.2rem;
  }

  .archive-header h1 {
    font-size: clamp(2.2rem, 9vw, 3.4rem);
    line-height: 1.03;
  }

  .archive-date {
    margin-top: 0.75rem;
  }
}
`;

function removeBotanicalRule(source) {
  if (!source.includes(BOTANICAL_RULE)) {
    throw new Error("Public layout polish could not find the hero botanical rule");
  }
  return source.replace(BOTANICAL_RULE, "");
}

export function publicLayoutPolishUiTransform() {
  return {
    name: "public-layout-polish-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(APP_SUFFIX)) {
        return { code: removeBotanicalRule(source), map: null };
      }
      if (normalizedId.endsWith(STYLES_SUFFIX)) {
        return { code: `${source}${COMPACT_HERO_CSS}`, map: null };
      }
      return null;
    },
  };
}
