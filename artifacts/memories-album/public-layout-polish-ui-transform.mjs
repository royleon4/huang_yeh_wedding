const APP_SUFFIX = "/src/client/App.jsx";
const STYLES_SUFFIX = "/src/client/styles.css";
const BOTTOM_NAV_SUFFIX = "/src/client/bottom-collection-nav.css";

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

const COMPACT_ALBUM_BUTTON_CSS = `

/* Preserve the original album-button footprint; only tighten the inner visual chip. */
.bottom-nav-side button {
  flex: 0 0 min(5.2rem, 46%);
  min-height: 3.7rem;
  padding: 0;
  background: transparent;
}

.bottom-nav-chip {
  min-width: 3.7rem;
  min-height: 2.55rem;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 0.08rem;
  border-radius: 0.72rem;
  padding: 0.22rem 0.42rem;
}

.bottom-nav-side button.active {
  background: transparent;
}

.bottom-nav-side button.active .bottom-nav-chip {
  background: rgba(219, 226, 213, 0.68);
}

.bottom-nav-icon {
  font-size: 0.98rem;
}

.bottom-nav-side small {
  font-size: 0.63rem;
  line-height: 1.15;
}

@media (max-width: 430px) {
  .bottom-nav-chip {
    min-width: 3.45rem;
    min-height: 2.45rem;
    padding: 0.18rem 0.32rem;
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
      if (normalizedId.endsWith(BOTTOM_NAV_SUFFIX)) {
        return { code: `${source}${COMPACT_ALBUM_BUTTON_CSS}`, map: null };
      }
      return null;
    },
  };
}
