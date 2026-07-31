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

Administrator cards use one full-width layout contract. The Google Drive upload-mode card is the height reference. A visible card whose content height exceeds twice that reference is collapsed automatically and receives an `展開編輯` control. The threshold is recalculated when content, tab visibility, or viewport dimensions change.

The former standalone subcategory tab is now part of General settings. Legacy `subcategory-ui` and logical `group5` administrator routes recover to General.
