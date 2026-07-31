const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Admin settings consolidation transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformAdmin(source) {
  let code = `import "./admin-unified-layout.css";\nimport {\n  saveRegisteredAdminSettings,\n  useAdminSettingsPendingCount,\n} from "./AdminSaveCoordinator.jsx";\n${source}`;

  code = code.replace(
    `import ProcessSelectorSettings from "./ProcessSelectorSettings.jsx";\n`,
    "",
  );
  code = code.replace(
    `          ["subcategory-ui", "子分類操作"],\n`,
    "",
  );
  code = code.replace(
    `        {tab === "subcategory-ui" && <ProcessSelectorSettings />}\n`,
    "",
  );

  code = replaceOnce(
    code,
    `export default function AdminApp() {\n  const [tab, setTab]`,
    `export default function AdminApp() {\n  const generalSettingsPendingCount = useAdminSettingsPendingCount();\n  const [tab, setTab]`,
    "administrator save coordinator hook",
  );

  code = replaceOnce(
    code,
    `  const pendingCount = changeSet.count + categoryVideoChanges.length;`,
    `  const entityPendingCount = changeSet.count + categoryVideoChanges.length;\n  const pendingCount = entityPendingCount + generalSettingsPendingCount;`,
    "combined pending count",
  );

  code = replaceOnce(
    code,
    `    let preserveCategoryOrder = changeSet.reordered;\n    let failedCreatedVideo = null;\n\n    try {`,
    `    let preserveCategoryOrder = changeSet.reordered;\n    let failedCreatedVideo = null;\n\n    const settingsResult = await saveRegisteredAdminSettings();\n    succeeded += settingsResult.succeeded;\n    failures.push(...settingsResult.failures);\n\n    try {`,
    "global settings save execution",
  );

  code = replaceOnce(
    code,
    `        {tab === "general" && (\n          <>\n            <GeneralSettings />\n            <AdminRefreshManagement\n              albums={albums}\n              categories={orderedCategories}\n            />\n          </>\n        )}`,
    `        <div\n          className="admin-general-panel"\n          hidden={tab !== "general"}\n          aria-hidden={tab !== "general"}\n        >\n          <GeneralSettings />\n          <AdminRefreshManagement\n            albums={albums}\n            categories={orderedCategories}\n          />\n        </div>`,
    "persistently mounted general settings panel",
  );

  return code;
}

export function adminSettingsConsolidationUiTransform() {
  return {
    name: "admin-settings-consolidation-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith(ADMIN_APP_SUFFIX)) return null;
      return { code: transformAdmin(source), map: null };
    },
  };
}
