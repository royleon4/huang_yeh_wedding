# Administrator unified save and card layout

## Save behavior

The bottom `儲存所有變更` action combines entity drafts with ordinary General settings.

General settings registered with the save coordinator:

- website copy
- Google Drive upload mode
- global gallery media order
- subcategory selector mode and wheel density
- visitor upload category selection

Each registered section keeps its own draft and persistence endpoint. The global action invokes each changed section separately, aggregates successes and failures, and leaves failed drafts available for retry.

Category/video rich-content editors keep their existing individual save actions. Destructive and maintenance actions such as permanent deletion and Drive refresh are also not queued into the global save action.

The General panel stays mounted while another administrator tab is selected, so unsaved drafts continue to participate in the global pending count.

## Card layout

Administrator cards use one full-width layout contract and remain fully expanded. There is no automatic height measurement, collapse threshold, generated `展開編輯` button, resize observer, or mutation observer for card folding.

The former standalone subcategory tab is now part of General settings. Legacy `subcategory-ui` and logical `group5` administrator routes recover to General.
