const APP_SUFFIX = "/src/client/App.jsx";
const MAIN_SUFFIX = "/src/client/main.jsx";

function replaceIfPresent(source, search, replacement) {
  return source.includes(search) ? source.replace(search, replacement) : source;
}

function transformPublicMain(source) {
  let code = source;
  code = replaceIfPresent(
    code,
    `          id: process.id,\n          zh: process.labelZh,`,
    `          id: process.id,\n          albumId: process.albumId ?? "wedding",\n          zh: process.labelZh,`,
  );
  code = replaceIfPresent(
    code,
    `          (left, right) =>\n            left.displayOrder - right.displayOrder ||\n            left.id.localeCompare(right.id),`,
    `          (left, right) =>\n            left.albumId.localeCompare(right.albumId) ||\n            left.displayOrder - right.displayOrder ||\n            left.id.localeCompare(right.id),`,
  );
  return code;
}

function transformPublicApp(source) {
  let code = source;

  if (
    code.includes(
      `import { normalizePinnedPhotosByProcess } from "../pinned-photo-settings.mjs";`,
    ) &&
    !code.includes(`from "./public-album-labels.mjs"`)
  ) {
    code = code.replace(
      `import { normalizePinnedPhotosByProcess } from "../pinned-photo-settings.mjs";`,
      `import { normalizePinnedPhotosByProcess } from "../pinned-photo-settings.mjs";\nimport {\n  allAlbumLabel,\n  filterPhotosByAlbumLabel,\n  labelsForAlbum,\n} from "./public-album-labels.mjs";`,
    );
  }

  code = replaceIfPresent(
    code,
    `        filterPhotos(photos, activeFilter, activeCollection),`,
    `        filterPhotosByAlbumLabel(\n          filterPhotos(photos, activeFilter, activeCollection),\n          activeFilter,\n          activeCollection,\n        ),`,
  );

  code = replaceIfPresent(
    code,
    `  const activeProcess =\n    activeCollection === "wedding"\n      ? activeFilter === "all"\n        ? ALL_PROCESS_DEFINITION\n        : processes.find((process) => process.id === activeFilter)\n      : null;\n  const activeProcessHtml =`,
    `  const activeLabels = labelsForAlbum(processes, activeCollection);\n  const activeAllLabel = allAlbumLabel(activeCollectionDefinition, lang);\n  const activeProcess =\n    activeCollection === "wedding"\n      ? activeFilter === "all"\n        ? ALL_PROCESS_DEFINITION\n        : activeLabels.find((process) => process.id === activeFilter)\n      : activeFilter === "all"\n        ? null\n        : activeLabels.find((process) => process.id === activeFilter);\n  const activeProcessHtml =`,
  );

  code = replaceIfPresent(
    code,
    `          {activeCollection === "wedding" && (\n            <ProcessSelector\n              ariaLabel={t.wedding}\n              activeId={activeFilter}\n              onSelect={chooseFilter}\n              items={[\n                {\n                  id: "all",\n                  number: "00",\n                  label: ALL_PROCESS_DEFINITION[lang] || t.allProcesses,\n                },\n                ...processes.map((process, index) => ({\n                  id: process.id,\n                  number: String(index + 1).padStart(2, "0"),\n                  label: process[lang],\n                })),\n              ]}\n            />\n          )}`,
    `          {activeCollection !== "guest" && activeLabels.length > 0 && (\n            <ProcessSelector\n              ariaLabel={activeCollectionDefinition?.[lang] ?? t.categories}\n              activeId={activeFilter}\n              onSelect={chooseFilter}\n              items={[\n                { id: "all", number: "00", label: activeAllLabel },\n                ...activeLabels.map((label, index) => ({\n                  id: label.id,\n                  number: String(index + 1).padStart(2, "0"),\n                  label: label[lang],\n                })),\n              ]}\n            />\n          )}`,
  );

  code = replaceIfPresent(
    code,
    `  const photoCollectionLabel = (photo) => {\n    if (activeCollection === "wedding") {\n      return (\n        processes.find((process) => photo.processIds.includes(process.id))?.[\n          lang\n        ] ?? ALL_PROCESS_DEFINITION[lang] ?? t.allProcesses\n      );\n    }\n    return activeCollectionDefinition?.[lang] ?? t.categories;\n  };`,
    `  const photoCollectionLabel = (photo) => {\n    if (activeCollection !== "guest") {\n      return (\n        activeLabels.find((label) => photo.processIds.includes(label.id))?.[lang] ??\n        activeAllLabel\n      );\n    }\n    return activeCollectionDefinition?.[lang] ?? t.categories;\n  };`,
  );

  code = replaceIfPresent(
    code,
    `  const subgroupItemsFor = (collectionId) => {\n    if (collectionId === "wedding") return processes;\n    if (collectionId === "guest") return guestGroups;\n    return [];\n  };`,
    `  const subgroupItemsFor = (collectionId) => {\n    if (collectionId === "guest") return guestGroups;\n    return labelsForAlbum(processes, collectionId);\n  };`,
  );

  return code;
}

export function publicAlbumLabelsUiTransform() {
  return {
    name: "public-album-labels-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(MAIN_SUFFIX)) {
        const code = transformPublicMain(source);
        return code === source ? null : { code, map: null };
      }
      if (normalizedId.endsWith(APP_SUFFIX)) {
        const code = transformPublicApp(source);
        return code === source ? null : { code, map: null };
      }
      return null;
    },
  };
}
