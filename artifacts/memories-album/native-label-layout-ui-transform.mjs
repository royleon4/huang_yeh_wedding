const APP_SUFFIX = "/src/client/App.jsx";
const SELECTOR_START = `          {activeCollection === "wedding" && (`;
const GALLERY_START = `        <section\n          id="archive-gallery"`;
const SECTION_CLOSE = `        </section>`;

function transformApp(source) {
  const selectorStart = source.indexOf(SELECTOR_START);
  const galleryStart = source.indexOf(GALLERY_START, selectorStart);
  const sectionClose = source.lastIndexOf(SECTION_CLOSE, galleryStart);

  if (selectorStart < 0 || galleryStart < 0 || sectionClose < selectorStart) {
    throw new Error(
      "Native label layout transform could not separate selector from collection introduction",
    );
  }

  return [
    source.slice(0, selectorStart),
    `${SECTION_CLOSE}\n\n        <div className="process-selector-sticky">\n`,
    source.slice(selectorStart, sectionClose),
    `        </div>`,
    source.slice(sectionClose + SECTION_CLOSE.length),
  ].join("");
}

export function nativeLabelLayoutUiTransform() {
  return {
    name: "native-label-layout-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith(APP_SUFFIX)) return null;
      return { code: transformApp(source), map: null };
    },
  };
}
